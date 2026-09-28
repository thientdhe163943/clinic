import { SupplyCategory } from '../entities/supply-category.entity';

export const SUPPLY_CATEGORY_REPOSITORY = Symbol('SUPPLY_CATEGORY_REPOSITORY');

export interface CreateSupplyCategoryData {
  name: string;
  description?: string | null;
  createdBy: string;
}

export interface UpdateSupplyCategoryData {
  name?: string;
  description?: string | null;
  updatedBy: string;
}

export interface SupplyCategoryRepository {
  findById(id: string): Promise<SupplyCategory | null>;
  findByName(name: string, excludeId?: string): Promise<SupplyCategory | null>;
  findMany(): Promise<SupplyCategory[]>;
  /** Feature 80 guard — true if any non-deleted Supply still references this category. */
  hasSupplies(categoryId: string): Promise<boolean>;
  create(data: CreateSupplyCategoryData): Promise<SupplyCategory>;
  update(id: string, data: UpdateSupplyCategoryData): Promise<SupplyCategory>;
  softDelete(id: string, deletedBy: string): Promise<void>;
}
