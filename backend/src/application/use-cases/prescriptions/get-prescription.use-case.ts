import { Inject, Injectable } from '@nestjs/common';
import { PrescriptionPrintDto, toPrescriptionResponse } from '../../dtos/prescriptions/prescription-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { PRESCRIPTION_REPOSITORY, PrescriptionRepository } from '../../../domain/repositories/prescription.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';

@Injectable()
export class GetPrescriptionUseCase {
  constructor(
    @Inject(PRESCRIPTION_REPOSITORY) private readonly prescriptionRepository: PrescriptionRepository,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
  ) {}

  async getByVisitId(visitId: string): Promise<PrescriptionPrintDto | null> {
    const visit = await this.visitRepository.findById(visitId);
    if (!visit) throw new ResourceNotFoundError('Visit');
    const prescription = await this.prescriptionRepository.findByVisitId(visitId);
    if (!prescription) return null;
    const withDetails = await this.prescriptionRepository.findWithDetailsById(prescription.id);
    return {
      ...toPrescriptionResponse(prescription),
      patientName: withDetails?.patientName ?? '',
      patientCode: withDetails?.patientCode ?? '',
      patientDateOfBirth: withDetails?.patientDateOfBirth ?? new Date(),
      doctorName: withDetails?.doctorName ?? '',
      appointmentTime: withDetails?.appointmentTime ?? new Date(),
    };
  }

  async getById(id: string): Promise<PrescriptionPrintDto> {
    const withDetails = await this.prescriptionRepository.findWithDetailsById(id);
    if (!withDetails) throw new ResourceNotFoundError('Prescription');
    return {
      ...toPrescriptionResponse(withDetails),
      patientName: withDetails.patientName,
      patientCode: withDetails.patientCode,
      patientDateOfBirth: withDetails.patientDateOfBirth,
      doctorName: withDetails.doctorName,
      appointmentTime: withDetails.appointmentTime,
    };
  }
}
