import { Inject, Injectable } from '@nestjs/common';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import { VisitNotCallableError, VisitNotFoundError } from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';

// Feature 16: Waiting/NoShow -> Called. Room availability is no longer
// checked here — it moved to StartVisitUseCase (Feature 16b), since Called
// is only "patient has been paged", not "patient is physically in the room".
@Injectable()
export class CallPatientUseCase {
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
    // CALLED is also callable: below NO_SHOW_CALL_THRESHOLD, MarkNoShowUseCase
    // deliberately leaves the visit in CALLED so staff can page again instead
    // of consuming a new queue slot (see comment there) — without this, a
    // visit that's been called once and doesn't show up can never be paged
    // again nor reach the no-show threshold, and stays stuck in CALLED forever.
    if (
      visit.status !== VisitStatus.WAITING &&
      visit.status !== VisitStatus.NO_SHOW &&
      visit.status !== VisitStatus.CALLED
    ) {
      throw new VisitNotCallableError();
    }

    const calledAt = new Date();
    const updated = await this.visitRepository.callPatient(visitId, calledAt, visit.calledCount + 1);

    await this.auditLog.write({
      userId: actorId,
      action: 'CALL_PATIENT',
      module: 'VISIT',
      targetId: visitId,
    });

    const appointment = await this.appointmentRepository.findById(visit.appointmentId);
    const [patient, doctor, service] = await Promise.all([
      this.patientRepository.findById(visit.patientId),
      this.userRepository.findById(visit.doctorId),
      appointment?.serviceId ? this.serviceRepository.findById(appointment.serviceId) : Promise.resolve(null),
    ]);

    try {
      this.realtimePort.emit(['DOCTOR', 'NURSE', 'RECEPTIONIST'], 'visit:changed', { visitId: updated.id });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

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
