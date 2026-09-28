import { Inject, Injectable } from '@nestjs/common';
import { CreateExaminationResultDto } from '../../dtos/visits/create-examination-result.dto';
import { ExaminationResultResponseDto } from '../../dtos/visits/examination-result-response.dto';
import {
  ExaminationResultExistsError,
  VisitNotFoundError,
  VisitNotInProgressError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { NOTIFICATION_PORT, NotificationPort } from '../../ports/notification.port';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface CreateExaminationResultInput extends CreateExaminationResultDto {
  visitId: string;
  actorId: string;
}

@Injectable()
export class CreateExaminationResultUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    @Inject(NOTIFICATION_PORT) private readonly notification: NotificationPort,
  ) {}

  async execute(input: CreateExaminationResultInput): Promise<ExaminationResultResponseDto> {
    const visit = await this.visitRepository.findById(input.visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.IN_PROGRESS) throw new VisitNotInProgressError();

    // Check if result already exists
    const existing = await this.visitRepository.findResultWithDetails(input.visitId);
    if (existing) throw new ExaminationResultExistsError();

    const accessCode = generateAccessCode();

    await this.visitRepository.createExaminationResult({
      visitId: input.visitId,
      diagnosis: input.diagnosis,
      clinicalNote: input.clinicalNote ?? null,
      treatmentResult: input.treatmentResult ?? null,
      followUpDate: input.followUpDate ? new Date(input.followUpDate) : null,
      accessCode,
      accessCodeExpiresAt: null,
      createdBy: input.actorId,
    });

    const [details, patient] = await Promise.all([
      this.visitRepository.findResultWithDetails(input.visitId),
      this.patientRepository.findById(visit.patientId),
      this.auditLog.write({
        userId: input.actorId,
        action: 'CREATE_EXAMINATION_RESULT',
        module: 'VISIT',
        targetId: input.visitId,
      }),
    ]).then(([d, p]) => [d, p] as const);

    // Feature 19 business rule: notification_logs type=RESULT_READY to patient.
    // Fire-and-forget: email gửi ngầm, không block response. Email only
    // (SMS channel removed) — skip if the patient has no email on file.
    if (patient && patient.notificationConsent && patient.email) {
      void this.notification.notify({
        userId: patient.userId,
        recipient: patient.email,
        channel: 'EMAIL',
        type: 'RESULT_READY',
        subject: 'Kết quả khám đã sẵn sàng',
        body: `Kết quả khám của bạn đã sẵn sàng. Mã tra cứu: ${accessCode}.`,
        refId: input.visitId,
      });
    }

    return {
      id: details!.result.id,
      visitId: details!.result.visitId,
      patientName: details!.patientName,
      patientCode: details!.patientCode,
      patientDateOfBirth: details!.patientDateOfBirth,
      patientGender: details!.patientGender,
      patientAddress: details!.patientAddress,
      doctorName: details!.doctorName,
      serviceName: details!.serviceName,
      appointmentTime: details!.appointmentTime,
      diagnosis: details!.result.diagnosis,
      clinicalNote: details!.result.clinicalNote,
      treatmentResult: details!.result.treatmentResult,
      followUpDate: details!.result.followUpDate,
      accessCode: details!.result.accessCode,
      accessCodeExpiresAt: details!.result.accessCodeExpiresAt,
      clsSummaries: details!.clsSummaries,
      createdAt: details!.result.createdAt,
    };
  }
}
