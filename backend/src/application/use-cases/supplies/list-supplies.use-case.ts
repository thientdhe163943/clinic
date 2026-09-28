import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import { SupplyListResponseDto, SupplyResponseDto } from '../../dtos/supplies/supply-response.dto';
import { SupplyStockStatus } from '../../../domain/enums/supply-stock-status.enum';
import { SUPPLY_REPOSITORY, SupplyListItem, SupplyRepository } from '../../../domain/repositories/supply.repository';

export interface ListSuppliesInput {
  category?: string;
  status?: SupplyStockStatus;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListSuppliesUseCase {
  constructor(@Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository) {}

  async execute(input: ListSuppliesInput): Promise<SupplyListResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { items, total } = await this.supplyRepository.findMany({
      categoryId: input.category,
      status: input.status,
      search: input.search,
      page,
      limit,
    });

    return {
      items: items.map((item) => this.toDto(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private toDto(item: SupplyListItem): SupplyResponseDto {
    const { supply, categoryName } = item;
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
