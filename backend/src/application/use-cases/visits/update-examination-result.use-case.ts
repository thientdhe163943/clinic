import { Inject, Injectable } from '@nestjs/common';
import { UpdateExaminationResultDto } from '../../dtos/visits/update-examination-result.dto';
import { ExaminationResultResponseDto } from '../../dtos/visits/examination-result-response.dto';
import { ExaminationResultNotFoundError, VisitNotFoundError, VisitNotInProgressError } from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';

export interface UpdateExaminationResultInput extends UpdateExaminationResultDto {
  visitId: string;
  actorId: string;
}

@Injectable()
export class UpdateExaminationResultUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdateExaminationResultInput): Promise<ExaminationResultResponseDto> {
    const visit = await this.visitRepository.findById(input.visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status === VisitStatus.COMPLETED) throw new VisitNotInProgressError();

    const existing = await this.visitRepository.findResultWithDetails(input.visitId);
    if (!existing) throw new ExaminationResultNotFoundError();

    await this.visitRepository.updateExaminationResult(input.visitId, {
      ...(input.diagnosis !== undefined ? { diagnosis: input.diagnosis } : {}),
      ...(input.clinicalNote !== undefined ? { clinicalNote: input.clinicalNote ?? null } : {}),
      ...(input.treatmentResult !== undefined ? { treatmentResult: input.treatmentResult ?? null } : {}),
      ...(input.followUpDate !== undefined
        ? { followUpDate: input.followUpDate ? new Date(input.followUpDate) : null }
        : {}),
      updatedBy: input.actorId,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'UPDATE_EXAMINATION_RESULT',
      module: 'VISIT',
      targetId: input.visitId,
    });

    const updated = await this.visitRepository.findResultWithDetails(input.visitId);

    return {
      id: updated!.result.id,
      visitId: updated!.result.visitId,
      patientName: updated!.patientName,
      patientCode: updated!.patientCode,
      patientDateOfBirth: updated!.patientDateOfBirth,
      patientGender: updated!.patientGender,
      patientAddress: updated!.patientAddress,
      doctorName: updated!.doctorName,
      serviceName: updated!.serviceName,
      appointmentTime: updated!.appointmentTime,
      diagnosis: updated!.result.diagnosis,
      clinicalNote: updated!.result.clinicalNote,
      treatmentResult: updated!.result.treatmentResult,
      followUpDate: updated!.result.followUpDate,
      accessCode: updated!.result.accessCode,
      accessCodeExpiresAt: updated!.result.accessCodeExpiresAt,
      clsSummaries: updated!.clsSummaries,
      createdAt: updated!.result.createdAt,
    };
  }
}
