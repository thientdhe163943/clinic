import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta, PaginationMeta } from '../../dtos/pagination.dto';
import { MedicalRecordQueryDto } from '../../dtos/medical-records/medical-record-query.dto';
import {
  MedicalRecordListItemDto,
  toMedicalRecordListItemDto,
} from '../../dtos/medical-records/medical-record-response.dto';
import {
  MEDICAL_RECORD_REPOSITORY,
  MedicalRecordRepository,
} from '../../../domain/repositories/medical-record.repository';
import { UserRole } from '../../../domain/enums/user-role.enum';

export interface ListMedicalRecordsInput extends MedicalRecordQueryDto {
  actorId: string;
  actorRole: UserRole;
}

export interface MedicalRecordListResponseDto {
  items: MedicalRecordListItemDto[];
  meta: PaginationMeta;
}

@Injectable()
export class ListMedicalRecordsUseCase {
  constructor(
    @Inject(MEDICAL_RECORD_REPOSITORY) private readonly medicalRecordRepository: MedicalRecordRepository,
  ) {}

  async execute(input: ListMedicalRecordsInput): Promise<MedicalRecordListResponseDto> {
    const result = await this.medicalRecordRepository.findMany({
      search: input.search,
      skip: input.skip,
      take: input.limit,
      actorId: input.actorId,
      actorRole: input.actorRole,
    });

    return {
      items: result.data.map(toMedicalRecordListItemDto),
      meta: buildPaginationMeta(input.page, input.limit, result.total),
    };
  }
}
