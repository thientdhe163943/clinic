import { Inject, Injectable } from '@nestjs/common';
import { ExaminationResultResponseDto } from '../../dtos/visits/examination-result-response.dto';
import { AccessCodeExpiredError, AccessCodeInvalidError } from '../../errors/application-error';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';

@Injectable()
export class GetResultByCodeUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
  ) {}

  async execute(accessCode: string): Promise<ExaminationResultResponseDto> {
    const details = await this.visitRepository.findResultByAccessCode(accessCode);
    if (!details) throw new AccessCodeInvalidError();

    if (
      details.result.accessCodeExpiresAt &&
      details.result.accessCodeExpiresAt < new Date()
    ) {
      throw new AccessCodeExpiredError();
    }

    return {
      id: details.result.id,
      visitId: details.result.visitId,
      patientName: details.patientName,
      patientCode: details.patientCode,
      patientDateOfBirth: details.patientDateOfBirth,
      patientGender: details.patientGender,
      patientAddress: details.patientAddress,
      doctorName: details.doctorName,
      serviceName: details.serviceName,
      appointmentTime: details.appointmentTime,
      diagnosis: details.result.diagnosis,
      clinicalNote: details.result.clinicalNote,
      treatmentResult: details.result.treatmentResult,
      followUpDate: details.result.followUpDate,
      accessCode: details.result.accessCode,
      accessCodeExpiresAt: details.result.accessCodeExpiresAt,
      clsSummaries: details.clsSummaries,
      createdAt: details.result.createdAt,
    };
  }
}
