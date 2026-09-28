import { Inject, Injectable } from '@nestjs/common';
import { SupplyCategoryResponseDto } from '../../dtos/supply-categories/supply-category-response.dto';
import { ResourceNotFoundError, SupplyCategoryNameExistsError } from '../../errors/application-error';
import { SupplyCategory } from '../../../domain/entities/supply-category.entity';
import {
  SUPPLY_CATEGORY_REPOSITORY,
  SupplyCategoryRepository,
} from '../../../domain/repositories/supply-category.repository';

export interface UpdateSupplyCategoryInput {
  id: string;
  name?: string;
  description?: string | null;
  updatedBy: string;
}

@Injectable()
export class UpdateSupplyCategoryUseCase {
  constructor(
    @Inject(SUPPLY_CATEGORY_REPOSITORY) private readonly supplyCategoryRepository: SupplyCategoryRepository,
  ) {}

  async execute(input: UpdateSupplyCategoryInput): Promise<SupplyCategoryResponseDto> {
    const category = await this.supplyCategoryRepository.findById(input.id);
    if (!category) throw new ResourceNotFoundError('SupplyCategory', { id: input.id });

    if (input.name !== undefined && input.name !== category.name) {
      const existing = await this.supplyCategoryRepository.findByName(input.name, input.id);
      if (existing) throw new SupplyCategoryNameExistsError();
    }

    const updated = await this.supplyCategoryRepository.update(input.id, {
      name: input.name,
      description: input.description,
      updatedBy: input.updatedBy,
    });

    return this.toDto(updated);
  }

  private toDto(category: SupplyCategory): SupplyCategoryResponseDto {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
