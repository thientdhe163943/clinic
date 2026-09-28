import type { PaginationMeta } from './api';

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListResponse {
  items: Supplier[];
  meta: PaginationMeta;
}

export interface CreateSupplierRequest {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
}

export interface UpdateSupplierRequest {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  description?: string;
}
