import { Inject, Injectable } from '@nestjs/common';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import { VisitNotCalledError, VisitNotFoundError } from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { NO_SHOW_CALL_THRESHOLD } from '../../../domain/constants/visit-queue.constant';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';

// Feature 16 A1: Called -> NoShow, but only once the patient has been
// called NO_SHOW_CALL_THRESHOLD (3) times without showing up. Below that,
// the visit simply stays Called so staff can page again without consuming
// a new queue slot.
@Injectable()
export class MarkNoShowUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(visitId: string, actorId: string): Promise<VisitResponseDto> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.CALLED) throw new VisitNotCalledError();

    // Version-up 0.2 item #9 tình huống A: if the room is currently busy
    // with another IN_PROGRESS visit, the patient may simply not have heard
    // the call yet (doctor was occupied) — don't count this call toward the
    // no-show threshold, same room-availability check StartVisitUseCase uses.
    const inProgressCount = await this.visitRepository.countInProgressByRoom(visit.roomId);
    const roomBusy = inProgressCount > 0;

    const updated =
      !roomBusy && visit.calledCount >= NO_SHOW_CALL_THRESHOLD
        ? await this.visitRepository.markNoShow(visitId)
        : visit;

    if (updated === visit) {
      await this.auditLog.write({
        userId: actorId,
        action: roomBusy ? 'MARK_ABSENT_ROOM_BUSY' : 'MARK_ABSENT_KEPT_CALLED',
        module: 'VISIT',
        targetId: visitId,
      });
    } else {
      await this.auditLog.write({
        userId: actorId,
        action: 'MARK_NO_SHOW',
        module: 'VISIT',
        targetId: visitId,
      });

      try {
        this.realtimePort.emit(['DOCTOR', 'NURSE', 'RECEPTIONIST'], 'visit:changed', { visitId: updated.id });
      } catch {
        // Realtime notification is best-effort — never let it fail the write.
      }
    }

    const appointment = await this.appointmentRepository.findById(visit.appointmentId);
    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(visit.patientId),
      this.userRepository.findById(visit.doctorId),
      appointment?.serviceId ? this.serviceRepository.findById(appointment.serviceId) : Promise.resolve(null),
    ]);

    return toVisitResponse(
      updated,
      patient?.fullName ?? '',
      patient?.patientCode ?? '',
      doctor?.fullName ?? '',
      service?.name ?? '',
      appointment?.appointmentTime ?? new Date(),
      appointment?.note ?? null,
      patient?.phone ?? '',
    );
  }
}
