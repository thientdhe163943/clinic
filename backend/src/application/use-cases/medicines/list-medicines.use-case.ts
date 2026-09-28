import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import { MedicineListResponseDto, MedicineResponseDto } from '../../dtos/medicines/medicine-response.dto';
import { Medicine } from '../../../domain/entities/medicine.entity';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';

export interface ListMedicinesInput {
  search?: string;
  /** undefined => legacy bare-array mode (prescribing dropdown), kept for
   * backward compatibility with the existing FE consumer
   * (medicinesApi.list() in clinic_system_frontend) which never sends this
   * param and destructures the response directly as an array. */
  page?: number;
  limit?: number;
}

// Cap for the legacy (non-paginated) mode — matches the original inline
// controller's `take: 200`.
const LEGACY_LIST_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 20;

@Injectable()
export class ListMedicinesUseCase {
  constructor(@Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository) {}

  async execute(input: ListMedicinesInput): Promise<MedicineResponseDto[] | MedicineListResponseDto> {
    const isPaginated = input.page !== undefined;

    if (!isPaginated) {
      // Legacy mode: only active medicines, capped list, no pagination
      // envelope — this is what the doctor-prescribing search dropdown
      // expects today.
      const { items } = await this.medicineRepository.findMany({
        search: input.search,
        onlyActive: true,
        page: 1,
        limit: LEGACY_LIST_LIMIT,
      });
      return items.map((item) => this.toDto(item));
    }

    const page = input.page ?? 1;
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;

    // Admin management mode: include inactive (but not soft-deleted)
    // medicines so they can be reactivated, and return a pagination
    // envelope per Feature 73 (`page=`).
    const { items, total } = await this.medicineRepository.findMany({
      search: input.search,
      onlyActive: false,
      page,
      limit,
    });

    return {
      items: items.map((item) => this.toDto(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private toDto(medicine: Medicine): MedicineResponseDto {
    return {
      id: medicine.id,
      name: medicine.name,
      activeIngredient: medicine.activeIngredient,
      dosageForm: medicine.dosageForm,
      unit: medicine.unit,
      price: medicine.price,
      description: medicine.description,
      contraindications: medicine.contraindications,
      isActive: medicine.isActive,
      createdAt: medicine.createdAt.toISOString(),
      updatedAt: medicine.updatedAt.toISOString(),
    };
  }
}
