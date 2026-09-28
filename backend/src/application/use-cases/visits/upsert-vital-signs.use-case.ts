import { Inject, Injectable } from '@nestjs/common';
import { UpsertVitalSignsDto } from '../../dtos/visits/vital-signs.dto';
import { VitalSignsRecord, VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { VisitNotFoundError } from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';

export interface UpsertVitalSignsInput extends UpsertVitalSignsDto {
  visitId: string;
  actorId: string;
}

@Injectable()
export class UpsertVitalSignsUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpsertVitalSignsInput): Promise<VitalSignsRecord> {
    const visit = await this.visitRepository.findById(input.visitId);
    if (!visit) throw new VisitNotFoundError();

    const result = await this.visitRepository.upsertVitalSigns(input.visitId, {
      systolicBp: input.systolicBp,
      diastolicBp: input.diastolicBp,
      heartRate: input.heartRate,
      temperature: input.temperature,
      spo2: input.spo2,
      weight: input.weight,
      height: input.height,
      recordedBy: input.actorId,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'UPSERT_VITAL_SIGNS',
      module: 'VISIT',
      targetId: input.visitId,
    });

    return result;
  }
}
