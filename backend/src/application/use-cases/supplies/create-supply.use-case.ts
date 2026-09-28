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

export interface CreateSupplyInput {
  categoryId: string;
  name: string;
  unit: MeasurementUnit;
  minStockLevel: number;
  description?: string | null;
  createdBy: string;
}

@Injectable()
export class CreateSupplyUseCase {
  constructor(
    @Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository,
    @Inject(SUPPLY_CATEGORY_REPOSITORY) private readonly supplyCategoryRepository: SupplyCategoryRepository,
  ) {}

  async execute(input: CreateSupplyInput): Promise<SupplyResponseDto> {
    const category = await this.supplyCategoryRepository.findById(input.categoryId);
    if (!category) throw new ResourceNotFoundError('SupplyCategory', { id: input.categoryId });

    // Feature 23 BR: "Validate tên không trùng trong cùng danh mục."
    const existing = await this.supplyRepository.findByNameInCategory(input.name, input.categoryId);
    if (existing) throw new ConflictError('Tên vật tư trong danh mục này');

    const supply = await this.supplyRepository.create({
      categoryId: input.categoryId,
      name: input.name,
      unit: input.unit,
      minStockLevel: input.minStockLevel,
      description: input.description ?? null,
      createdBy: input.createdBy,
    });

    return this.toDto(supply, category.name);
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
