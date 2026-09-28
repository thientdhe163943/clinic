import { Inject, Injectable } from '@nestjs/common';
import { SupplyCategoryResponseDto } from '../../dtos/supply-categories/supply-category-response.dto';
import { SupplyCategory } from '../../../domain/entities/supply-category.entity';
import {
  SUPPLY_CATEGORY_REPOSITORY,
  SupplyCategoryRepository,
} from '../../../domain/repositories/supply-category.repository';

@Injectable()
export class ListSupplyCategoriesUseCase {
  constructor(
    @Inject(SUPPLY_CATEGORY_REPOSITORY) private readonly supplyCategoryRepository: SupplyCategoryRepository,
  ) {}

  async execute(): Promise<SupplyCategoryResponseDto[]> {
    const categories = await this.supplyCategoryRepository.findMany();
    return categories.map((category) => this.toDto(category));
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
