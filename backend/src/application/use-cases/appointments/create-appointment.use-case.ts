import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppointmentResponseDto, toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import { CreateAppointmentRequestDto } from '../../dtos/appointments/create-appointment.dto';
import {
  ApplicationError,
  AppointmentServiceTypeInvalidError,
  AppointmentTimeInPastError,
  ConflictError,
  DoctorNotScheduledError,
  LunchBreakBookingError,
  ResourceNotFoundError,
} from '../../errors/application-error';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentTrustService } from '../../services/appointment-trust.service';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { APPOINTMENT_SLOT_MINUTES } from '../../../domain/constants/appointment-slot.constant';
import { nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';
import { isWithinLunchBreak } from '../../../infrastructure/persistence/repositories/prisma-work-schedule.repository';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { User } from '../../../domain/entities/user.entity';
import { Service } from '../../../domain/entities/service.entity';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';

export interface CreateAppointmentInput extends CreateAppointmentRequestDto {
  bookedBy: string;
  bookedByRole: UserRole;
}

@Injectable()
export class CreateAppointmentUseCase {
  private readonly logger = new Logger(CreateAppointmentUseCase.name);

  constructor(
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly appointmentTrustService: AppointmentTrustService,
  ) {}

  async execute(input: CreateAppointmentInput): Promise<AppointmentResponseDto> {
    // Business Rule: a patient booker always books for themselves — resolve their own
    // patient record and ignore any patientId sent in the request body (prevents IDOR).
    let patientId: string;
    if (input.bookedByRole === UserRole.PATIENT) {
      const selfPatient = await this.patientRepository.findByUserId(input.bookedBy);
      if (!selfPatient) {
        this.logger.warn(
          `Create appointment failed: no patient profile for booking user ${input.bookedBy}`,
        );
        throw new ResourceNotFoundError('Patient', { userId: input.bookedBy });
      }
      patientId = selfPatient.id;
    } else {
      if (!input.patientId?.trim()) {
        this.logger.warn(`Create appointment failed: patientId missing on receptionist booking (actor=${input.bookedBy})`);
        throw new ApplicationError(MSG.ERR_0006, 400);
      }
      patientId = input.patientId;
    }

    const patient = await this.patientRepository.findById(patientId);
    if (!patient) {
      this.logger.warn(`Create appointment failed: patient ${patientId} not found`);
      throw new ResourceNotFoundError('Patient', { id: patientId });
    }

    // Version-up 0.2 item #7, anti-spam business rule #2: a patient may not
    // hold more than the configured number of PENDING/CONFIRMED future
    // appointments at once — applies to both receptionist- and
    // patient-booked appointments since both share this use case.
    await this.appointmentTrustService.assertPendingLimitNotExceeded(patientId);

    // Business Rule: doctor and service are optional at booking time — the
    // receptionist may leave either unassigned and fill them in later via
    // UpdateAppointmentUseCase. Existence/coverage/conflict checks below only
    // run when the corresponding id is actually supplied.
    let doctor: User | null = null;
    if (input.doctorId) {
      doctor = await this.userRepository.findById(input.doctorId);
      if (!doctor) {
        this.logger.warn(`Create appointment failed: doctor ${input.doctorId} not found`);
        throw new ResourceNotFoundError('Doctor', { id: input.doctorId });
      }
    }

    let service: Service | null = null;
    if (input.serviceId) {
      service = await this.serviceRepository.findById(input.serviceId);
      if (!service) {
        this.logger.warn(`Create appointment failed: service ${input.serviceId} not found`);
        throw new ResourceNotFoundError('Service', { id: input.serviceId });
      }
      if (service.type !== ServiceType.EXAMINATION) {
        this.logger.warn(
          `Create appointment failed: service ${input.serviceId} is type=${service.type}, not EXAMINATION`,
        );
        throw new AppointmentServiceTypeInvalidError();
      }
    }

    // Business Rule (A1): doctor must have a work-schedule shift covering this slot.
    let scheduleId: string | null = null;
    if (input.doctorId) {
      const shift = await this.workScheduleRepository.findCoveringShift(input.doctorId, input.appointmentTime);
      if (!shift) {
        this.logger.warn(
          `Create appointment failed: doctor ${input.doctorId} has no work schedule covering ${input.appointmentTime.toISOString()}`,
        );
        throw new DoctorNotScheduledError();
      }
      scheduleId = shift.id;
    } else if (isWithinLunchBreak(input.appointmentTime)) {
      // The doctor-less "Đặt lịch nhanh" path has no shift to check against
      // findCoveringShift, so the clinic's lunch break must be rejected here
      // explicitly instead.
      this.logger.warn(
        `Create appointment failed: appointmentTime ${input.appointmentTime.toISOString()} falls in the clinic's lunch break (actor=${input.bookedBy})`,
      );
      throw new LunchBreakBookingError();
    }

    // Business Rule: appointments can only be booked on fixed
    // APPOINTMENT_SLOT_MINUTES-minute slot boundaries. The frontend only ever
    // submits slot-aligned times, but a direct API call with an off-grid time
    // must still be rejected.
    const minutesSinceMidnight = input.appointmentTime.getUTCHours() * 60 + input.appointmentTime.getUTCMinutes();
    const isSlotAligned =
      minutesSinceMidnight % APPOINTMENT_SLOT_MINUTES === 0 &&
      input.appointmentTime.getUTCSeconds() === 0 &&
      input.appointmentTime.getUTCMilliseconds() === 0;
    if (!isSlotAligned) {
      this.logger.warn(
        `Create appointment failed: appointmentTime ${input.appointmentTime.toISOString()} is not aligned to the ${APPOINTMENT_SLOT_MINUTES}-minute slot grid (actor=${input.bookedBy})`,
      );
      throw new ApplicationError(MSG.ERR_0006, 400);
    }

    // Business Rule: a slot that has already passed cannot be booked — the
    // available-doctors listing already hides/disables it, but a direct API
    // call must be rejected too, not just the UI.
    if (input.appointmentTime.getTime() <= nowAsClinicNaiveUtc().getTime()) {
      this.logger.warn(
        `Create appointment failed: appointmentTime ${input.appointmentTime.toISOString()} is in the past (actor=${input.bookedBy})`,
      );
      throw new AppointmentTimeInPastError();
    }

    // Business Rule (A2): patient must not already have an appointment at this exact datetime.
    const conflict = await this.appointmentRepository.findConflict(patientId, input.appointmentTime);
    if (conflict) {
      this.logger.warn(
        `Create appointment failed: patient ${patientId} already has appointment ${conflict.id} at ${input.appointmentTime.toISOString()}`,
      );
      throw new ConflictError('Khung giờ hẹn');
    }

    // Business Rule (A2b): the doctor must not already be booked by another
    // patient at this exact datetime — findDoctorConflict existed on the
    // repository but was never wired up here, so two patients could book the
    // same doctor's same slot. Only relevant when a doctor was actually chosen.
    if (input.doctorId) {
      const doctorConflict = await this.appointmentRepository.findDoctorConflict(
        input.doctorId,
        input.appointmentTime,
      );
      if (doctorConflict) {
        this.logger.warn(
          `Create appointment failed: doctor ${input.doctorId} already booked (appointment ${doctorConflict.id}) at ${input.appointmentTime.toISOString()}`,
        );
        throw new ConflictError('Khung giờ của bác sĩ này');
      }
    }

    const isReceptionistBooked = input.bookedByRole !== UserRole.PATIENT;
    let status = isReceptionistBooked ? AppointmentStatus.CONFIRMED : AppointmentStatus.PENDING;

    // Version-up 0.2 item #7, anti-spam business rule #4: a receptionist
    // booking would normally auto-CONFIRMED (see above), but a patient with
    // too many recent no-shows loses that fast-path — the appointment is
    // still created (never blocked), just left PENDING for a receptionist to
    // manually confirm. Patient self-bookings are already PENDING, so this
    // never has an observable effect on that branch.
    if (status === AppointmentStatus.CONFIRMED && (await this.appointmentTrustService.hasExcessiveNoShows(patientId))) {
      this.logger.warn(
        `Create appointment: patient ${patientId} has excessive recent no-shows — withholding auto-CONFIRMED`,
      );
      status = AppointmentStatus.PENDING;
    }

    const appointment = await this.appointmentRepository.create({
      patientId,
      doctorId: input.doctorId ?? null,
      serviceId: input.serviceId ?? null,
      scheduleId,
      appointmentTime: input.appointmentTime,
      status,
      note: input.note,
      bookedBy: input.bookedBy,
    });

    await this.appointmentRepository.addHistory({
      appointmentId: appointment.id,
      oldStatus: null,
      newStatus: status,
      newTime: appointment.appointmentTime,
      newDoctorId: appointment.doctorId,
      changedBy: input.bookedBy,
    });

    await this.auditLog.write({
      userId: input.bookedBy,
      action: 'APPOINTMENT_CREATED',
      module: 'APPOINTMENT',
      targetId: appointment.id,
    });

    try {
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: appointment.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    return toAppointmentResponse(
      appointment,
      patient.fullName,
      patient.patientCode,
      doctor ? DoctorDisplayName.format(doctor.fullName) : '',
      service?.name ?? '',
    );
  }
}
