import { PaginationMeta } from '../pagination.dto';

export interface SupplyResponseDto {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  description: string | null;
  isActive: boolean;
  // Feature 25 BR: "Hiển thị badge cảnh báo khi stock < minStock" — computed
  // here so the FE can render the low-stock badge without an extra call.
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyListResponseDto {
  items: SupplyResponseDto[];
  meta: PaginationMeta;
}
