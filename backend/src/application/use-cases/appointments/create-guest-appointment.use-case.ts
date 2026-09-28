import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthUserDto } from '../../dtos/auth/login-response.dto';
import { AppointmentResponseDto, toAppointmentResponse } from '../../dtos/appointments/appointment-response.dto';
import { CreateGuestAppointmentRequestDto } from '../../dtos/appointments/create-guest-appointment.dto';
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
import { DEFAULT_PATIENT_PASSWORD } from '../../../domain/value-objects/password-policy.vo';
import { PatientCode } from '../../../domain/value-objects/patient-code.vo';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { AppointmentTrustService } from '../../services/appointment-trust.service';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { Gender } from '../../../domain/enums/gender.enum';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { APPOINTMENT_SLOT_MINUTES } from '../../../domain/constants/appointment-slot.constant';
import { nowAsClinicNaiveUtc } from '../../../domain/services/clinic-calendar.util';
import { isWithinLunchBreak } from '../../../infrastructure/persistence/repositories/prisma-work-schedule.repository';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import {
  APPOINTMENT_REPOSITORY,
  AppointmentRepository,
} from '../../../domain/repositories/appointment.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  WORK_SCHEDULE_REPOSITORY,
  WorkScheduleRepository,
} from '../../../domain/repositories/work-schedule.repository';
import { issueRefreshToken, signAccessToken } from '../auth/issue-auth-tokens.util';

const BCRYPT_ROUNDS = 10;
const PATIENT_CODE_GENERATION_ATTEMPTS = 5;

export interface CreateGuestAppointmentInput extends CreateGuestAppointmentRequestDto {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CreateGuestAppointmentResult {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  mustChangePassword: boolean;
  user: AuthUserDto;
  appointment: AppointmentResponseDto;
}

// Unauthenticated "book an appointment and create my account in one step"
// flow (Feature 59 guest-booking variant). Composes RegisterUseCase's
// account-creation steps with CreateAppointmentUseCase's patient-booking
// steps. This codebase has no tx-injection pattern on its repositories (every
// use case just issues sequential repository calls — see RegisterUseCase
// itself), so this mirrors that same convention rather than introducing a
// one-off prisma.$transaction here; a failure partway through can leave a
// created User/Patient without an appointment, same risk profile RegisterUseCase
// already accepts for User-without-Patient today.
@Injectable()
export class CreateGuestAppointmentUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(WORK_SCHEDULE_REPOSITORY) private readonly workScheduleRepository: WorkScheduleRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
    private readonly appointmentTrustService: AppointmentTrustService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: CreateGuestAppointmentInput): Promise<CreateGuestAppointmentResult> {
    // ─── Step 1: account creation (mirrors RegisterUseCase) ───────────────
    // No password field on this DTO — the guest doesn't choose one; the
    // account starts on DEFAULT_PATIENT_PASSWORD (same as a
    // receptionist-created walk-in patient) and mustChangePassword forces
    // them to set their own on first login.
    //
    // Only phone/fullName/dateOfBirth are actually required from the guest
    // (quick-account business rule) — email/idCard/gender stay genuinely
    // optional. users.email became nullable 2026-08-07 (previously an
    // omitted email got a synthetic `${phone}@guest.local` placeholder to
    // satisfy a NOT NULL column — no longer needed).
    //
    // dateOfBirth arrives as a plain string here (the DTO uses
    // @IsDateString(), not @Type(() => Date)), so class-validator's @MaxDate
    // can't be combined with it directly — checked manually instead.
    if (new Date(input.dateOfBirth).getTime() > Date.now()) {
      throw new ApplicationError(MSG.ERR_0006, 400);
    }

    const email = input.email?.trim() || null;

    if (email) {
      const existingByEmail = await this.userRepository.findByEmail(email);
      if (existingByEmail) throw new ConflictError('Email');
    }

    const existingByPhone = await this.userRepository.findByPhone(input.phone);
    if (existingByPhone) throw new ConflictError('Số điện thoại');

    const existingPatient = await this.patientRepository.findByPhone(input.phone);
    if (existingPatient?.userId) throw new ConflictError('Số điện thoại');

    // Version-up 0.2 item #7, anti-spam business rule #2: only meaningful
    // when this guest phone number already has a patient record (a brand
    // new patient trivially has 0 pending appointments) — checked before
    // creating a new User account below so a patient already at the limit
    // isn't left with an unnecessary orphan account.
    if (existingPatient) {
      await this.appointmentTrustService.assertPendingLimitNotExceeded(existingPatient.id);
    }

    if (input.idCard) {
      const existingByIdCard = await this.patientRepository.findByIdCard(input.idCard);
      if (existingByIdCard && existingByIdCard.id !== existingPatient?.id) {
        throw new ConflictError('CCCD/CMND');
      }

      // idCard now also lands on users.id_card (unique), not just
      // patients.id_card checked above — a staff member sharing the same real
      // CCCD would otherwise hit an unhandled unique-constraint error instead
      // of a clean ConflictError.
      const existingUserByIdCard = await this.userRepository.findByIdCard(input.idCard);
      if (existingUserByIdCard) throw new ConflictError('CCCD/CMND');
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PATIENT_PASSWORD, BCRYPT_ROUNDS);
    const user = await this.userRepository.create({
      fullName: input.fullName,
      email,
      phone: input.phone,
      passwordHash,
      role: UserRole.PATIENT,
      mustChangePassword: true,
      idCard: input.idCard ?? null,
    });

    let patientId: string;
    if (existingPatient) {
      const linked = await this.patientRepository.linkUser(existingPatient.id, user.id);
      patientId = linked.id;
    } else {
      patientId = await this.createPatientProfile(user.id, input);
    }

    const patient = await this.patientRepository.findById(patientId);
    if (!patient) throw new ResourceNotFoundError('Patient', { id: patientId });

    // ─── Step 2: appointment booking (mirrors CreateAppointmentUseCase's
    // patient-booked branch — see item 2's optional doctor/service rules) ──
    let doctorName = '';
    if (input.doctorId) {
      const doctor = await this.userRepository.findById(input.doctorId);
      if (!doctor) throw new ResourceNotFoundError('Doctor', { id: input.doctorId });
      doctorName = DoctorDisplayName.format(doctor.fullName);
    }

    let serviceName = '';
    if (input.serviceId) {
      const service = await this.serviceRepository.findById(input.serviceId);
      if (!service) throw new ResourceNotFoundError('Service', { id: input.serviceId });
      if (service.type !== ServiceType.EXAMINATION) throw new AppointmentServiceTypeInvalidError();
      serviceName = service.name;
    }

    let scheduleId: string | null = null;
    if (input.doctorId) {
      const shift = await this.workScheduleRepository.findCoveringShift(input.doctorId, input.appointmentTime);
      if (!shift) throw new DoctorNotScheduledError();
      scheduleId = shift.id;
    } else if (isWithinLunchBreak(input.appointmentTime)) {
      // The doctor-less "Đặt lịch nhanh" path has no shift to check against
      // findCoveringShift, so the clinic's lunch break must be rejected here
      // explicitly instead.
      throw new LunchBreakBookingError();
    }

    const minutesSinceMidnight = input.appointmentTime.getUTCHours() * 60 + input.appointmentTime.getUTCMinutes();
    const isSlotAligned =
      minutesSinceMidnight % APPOINTMENT_SLOT_MINUTES === 0 &&
      input.appointmentTime.getUTCSeconds() === 0 &&
      input.appointmentTime.getUTCMilliseconds() === 0;
    if (!isSlotAligned) throw new ApplicationError(MSG.ERR_0006, 400);

    if (input.appointmentTime.getTime() <= nowAsClinicNaiveUtc().getTime()) {
      throw new AppointmentTimeInPastError();
    }

    const conflict = await this.appointmentRepository.findConflict(patientId, input.appointmentTime);
    if (conflict) throw new ConflictError('Khung giờ hẹn');

    if (input.doctorId) {
      const doctorConflict = await this.appointmentRepository.findDoctorConflict(
        input.doctorId,
        input.appointmentTime,
      );
      if (doctorConflict) throw new ConflictError('Khung giờ của bác sĩ này');
    }

    // Version-up 0.2 item #7, anti-spam business rule #4 ("no-show trust
    // score"): unlike CreateAppointmentUseCase's receptionist-booked branch,
    // a guest-booked appointment is *always* created PENDING (never
    // auto-CONFIRMED) — there is no auto-confirm fast-path here to withhold,
    // so AppointmentTrustService.hasExcessiveNoShows() has nothing to gate
    // and is intentionally not called on this path.
    const appointment = await this.appointmentRepository.create({
      patientId,
      doctorId: input.doctorId ?? null,
      serviceId: input.serviceId ?? null,
      scheduleId,
      appointmentTime: input.appointmentTime,
      status: AppointmentStatus.PENDING,
      note: input.note,
      bookedBy: user.id,
    });

    await this.appointmentRepository.addHistory({
      appointmentId: appointment.id,
      oldStatus: null,
      newStatus: AppointmentStatus.PENDING,
      newTime: appointment.appointmentTime,
      newDoctorId: appointment.doctorId,
      changedBy: user.id,
    });

    await this.auditLog.write({
      userId: user.id,
      action: 'APPOINTMENT_CREATED',
      module: 'APPOINTMENT',
      targetId: appointment.id,
    });

    try {
      this.realtimePort.emit('RECEPTIONIST', 'appointment:changed', { appointmentId: appointment.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

    // ─── Step 3: auto-login (mirrors AuthController's register handler) ──
    const accessToken = signAccessToken(this.jwtService, user);
    const refreshToken = await issueRefreshToken(this.refreshTokenRepository, this.configService, user.id, {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return {
      accessToken,
      refreshToken,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
      appointment: toAppointmentResponse(appointment, patient.fullName, patient.patientCode, doctorName, serviceName),
    };
  }

  private async createPatientProfile(userId: string, input: CreateGuestAppointmentInput): Promise<string> {
    for (let attempt = 0; attempt < PATIENT_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        const created = await this.patientRepository.create({
          patientCode: PatientCode.generate().value,
          fullName: input.fullName,
          email: input.email?.trim() || null,
          dateOfBirth: new Date(input.dateOfBirth),
          gender: input.gender ?? Gender.OTHER,
          phone: input.phone,
          idCard: input.idCard ?? null,
          userId,
          createdBy: userId,
        });
        return created.id;
      } catch (error) {
        const isLastAttempt = attempt === PATIENT_CODE_GENERATION_ATTEMPTS - 1;
        if (isLastAttempt) throw error;
      }
    }
    // Unreachable — the loop above always either returns or throws.
    throw new ConflictError('Mã bệnh nhân');
  }
}
