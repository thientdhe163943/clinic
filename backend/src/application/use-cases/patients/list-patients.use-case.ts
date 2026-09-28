import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta, PaginationMeta } from '../../dtos/pagination.dto';
import { PatientQueryDto } from '../../dtos/patients/patient-query.dto';
import { PatientResponseDto, toPatientResponse } from '../../dtos/patients/patient-response.dto';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

export interface PatientListResponseDto {
  items: PatientResponseDto[];
  meta: PaginationMeta;
}

@Injectable()
export class ListPatientsUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository) {}

  async execute(query: PatientQueryDto): Promise<PatientListResponseDto> {
    const result = await this.patientRepository.findMany({
      search: query.search,
      skip: query.skip,
      take: query.limit,
    });

    return {
      items: result.data.map(toPatientResponse),
      meta: buildPaginationMeta(query.page, query.limit, result.total),
    };
  }
}
