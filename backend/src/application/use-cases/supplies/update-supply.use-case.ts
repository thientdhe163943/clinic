import { Inject, Injectable } from '@nestjs/common';
import { SupplyResponseDto } from '../../dtos/supplies/supply-response.dto';
import { ConflictError, ResourceNotFoundError } from '../../errors/application-error';
import { Supply } from '../../../domain/entities/supply.entity';
import {
  SUPPLY_CATEGORY_REPOSITORY,
  SupplyCategoryRepository,
} from '../../../domain/repositories/supply-category.repository';
import { SUPPLY_REPOSITORY, SupplyRepository } from '../../../domain/repositories/supply.repository';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';

export interface UpdateSupplyInput {
  id: string;
  categoryId?: string;
  name?: string;
  unit?: MeasurementUnit;
  minStockLevel?: number;
  description?: string | null;
  isActive?: boolean;
  updatedBy: string;
}

@Injectable()
export class UpdateSupplyUseCase {
  constructor(
    @Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository,
    @Inject(SUPPLY_CATEGORY_REPOSITORY) private readonly supplyCategoryRepository: SupplyCategoryRepository,
  ) {}

  async execute(input: UpdateSupplyInput): Promise<SupplyResponseDto> {
    const supply = await this.supplyRepository.findById(input.id);
    if (!supply) throw new ResourceNotFoundError('Supply', { id: input.id });

    const nextCategoryId = input.categoryId !== undefined ? input.categoryId : supply.categoryId;
    let categoryName: string | undefined;
    if (input.categoryId !== undefined && input.categoryId !== supply.categoryId) {
      const category = await this.supplyCategoryRepository.findById(input.categoryId);
      if (!category) throw new ResourceNotFoundError('SupplyCategory', { id: input.categoryId });
      categoryName = category.name;
    }

    const nextName = input.name !== undefined ? input.name : supply.name;
    const nameOrCategoryChanged =
      (input.name !== undefined && input.name !== supply.name) ||
      (input.categoryId !== undefined && input.categoryId !== supply.categoryId);
    if (nameOrCategoryChanged) {
      const existing = await this.supplyRepository.findByNameInCategory(nextName, nextCategoryId, input.id);
      if (existing) throw new ConflictError('Tên vật tư trong danh mục này');
    }

    const updated = await this.supplyRepository.update(input.id, {
      categoryId: input.categoryId,
      name: input.name,
      unit: input.unit,
      minStockLevel: input.minStockLevel,
      description: input.description,
      isActive: input.isActive,
      updatedBy: input.updatedBy,
    });

    if (!categoryName) {
      const category = await this.supplyCategoryRepository.findById(updated.categoryId);
      categoryName = category?.name ?? '';
    }

    return this.toDto(updated, categoryName);
  }

  private toDto(supply: Supply, categoryName: string): SupplyResponseDto {
    return {
      id: supply.id,
      categoryId: supply.categoryId,
      categoryName,
      name: supply.name,
      unit: supply.unit,
      currentStock: supply.currentStock,
      minStockLevel: supply.minStockLevel,
      description: supply.description,
      isActive: supply.isActive,
      isLowStock: supply.currentStock < supply.minStockLevel,
      createdAt: supply.createdAt.toISOString(),
      updatedAt: supply.updatedAt.toISOString(),
    };
  }
}
