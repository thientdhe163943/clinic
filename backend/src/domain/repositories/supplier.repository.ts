import { Supplier } from '../entities/supplier.entity';

export const SUPPLIER_REPOSITORY = Symbol('SUPPLIER_REPOSITORY');

export interface SupplierListFilter {
  search?: string;
  page: number;
  limit: number;
}

export interface CreateSupplierData {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  createdBy: string;
}

export interface UpdateSupplierData {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  description?: string | null;
  updatedBy: string;
}

export interface SupplierRepository {
  findById(id: string): Promise<Supplier | null>;
  findByName(name: string): Promise<Supplier | null>;
  findByPhone(phone: string, excludeId?: string): Promise<Supplier | null>;
  findByEmail(email: string, excludeId?: string): Promise<Supplier | null>;
  findMany(filter: SupplierListFilter): Promise<{ items: Supplier[]; total: number }>;
  create(data: CreateSupplierData): Promise<Supplier>;
  update(id: string, data: UpdateSupplierData): Promise<Supplier>;
  softDelete(id: string, deletedBy: string): Promise<void>;
  /** Returns true if the supplier is referenced by any supply import batch. */
  isInUse(id: string): Promise<boolean>;
}
