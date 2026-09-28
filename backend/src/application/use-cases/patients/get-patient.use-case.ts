import { Inject, Injectable } from '@nestjs/common';
import { PatientResponseDto, toPatientResponse } from '../../dtos/patients/patient-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

@Injectable()
export class GetPatientUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository) {}

  async execute(id: string): Promise<PatientResponseDto> {
    const patient = await this.patientRepository.findById(id);
    if (!patient) throw new ResourceNotFoundError('Patient');

    return toPatientResponse(patient);
  }
}
