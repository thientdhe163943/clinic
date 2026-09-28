import { Inject, Injectable } from '@nestjs/common';
import { VisitResponseDto, toVisitResponse } from '../../dtos/visits/visit-response.dto';
import {
  VisitNoClsOrderForHoldError,
  VisitNotFoundError,
  VisitNotHoldableError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';

// Feature 17b: InProgress -> AwaitingResults, releasing the room so the
// doctor can call the next patient while this one is off doing CLS. Only
// available once at least one CLS order has been created for the visit.
@Injectable()
export class HoldForResultsUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
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
    if (visit.status !== VisitStatus.IN_PROGRESS) throw new VisitNotHoldableError();

    const clsOrders = await this.clsOrderRepository.findByVisitId(visitId);
    if (clsOrders.length === 0) throw new VisitNoClsOrderForHoldError();

    const updated = await this.visitRepository.holdForResults(visitId);

    await this.auditLog.write({
      userId: actorId,
      action: 'HOLD_VISIT_FOR_RESULTS',
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
