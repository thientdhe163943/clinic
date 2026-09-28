import { PaginationMeta } from '../pagination.dto';

export interface SupplierResponseDto {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListResponseDto {
  items: SupplierResponseDto[];
  meta: PaginationMeta;
}
