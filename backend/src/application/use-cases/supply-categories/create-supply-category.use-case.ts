import { Inject, Injectable } from '@nestjs/common';
import { SupplyCategoryResponseDto } from '../../dtos/supply-categories/supply-category-response.dto';
import { SupplyCategoryNameExistsError } from '../../errors/application-error';
import { SupplyCategory } from '../../../domain/entities/supply-category.entity';
import {
  SUPPLY_CATEGORY_REPOSITORY,
  SupplyCategoryRepository,
} from '../../../domain/repositories/supply-category.repository';

export interface CreateSupplyCategoryInput {
  name: string;
  description?: string | null;
  createdBy: string;
}

@Injectable()
export class CreateSupplyCategoryUseCase {
  constructor(
    @Inject(SUPPLY_CATEGORY_REPOSITORY) private readonly supplyCategoryRepository: SupplyCategoryRepository,
  ) {}

  async execute(input: CreateSupplyCategoryInput): Promise<SupplyCategoryResponseDto> {
    const existing = await this.supplyCategoryRepository.findByName(input.name);
    if (existing) throw new SupplyCategoryNameExistsError();

    const category = await this.supplyCategoryRepository.create({
      name: input.name,
      description: input.description ?? null,
      createdBy: input.createdBy,
    });

    return this.toDto(category);
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
