import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import { SupplierListResponseDto, SupplierResponseDto } from '../../dtos/suppliers/supplier-response.dto';
import { Supplier } from '../../../domain/entities/supplier.entity';
import { SUPPLIER_REPOSITORY, SupplierRepository } from '../../../domain/repositories/supplier.repository';

export interface ListSuppliersInput {
  search?: string;
  /** undefined => legacy bare-array mode, kept for backward compatibility
   * with the Supply-import form's supplier picker (suppliersApi.list() in
   * clinic_system_frontend), which never sends this param. */
  page?: number;
  limit?: number;
}

const LEGACY_LIST_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 20;

@Injectable()
export class ListSuppliersUseCase {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly supplierRepository: SupplierRepository) {}

  async execute(input: ListSuppliersInput): Promise<SupplierResponseDto[] | SupplierListResponseDto> {
    if (input.page === undefined) {
      const { items } = await this.supplierRepository.findMany({
        search: input.search,
        page: 1,
        limit: LEGACY_LIST_LIMIT,
      });
      return items.map((item) => this.toDto(item));
    }

    const page = input.page;
    const limit = input.limit ?? DEFAULT_PAGE_LIMIT;

    const { items, total } = await this.supplierRepository.findMany({ search: input.search, page, limit });

    return {
      items: items.map((item) => this.toDto(item)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private toDto(supplier: Supplier): SupplierResponseDto {
    return {
      id: supplier.id,
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      description: supplier.description,
      createdAt: supplier.createdAt.toISOString(),
      updatedAt: supplier.updatedAt.toISOString(),
    };
  }
}
