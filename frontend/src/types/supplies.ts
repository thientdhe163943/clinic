import type { PaginationMeta } from '@/types/api';

export type SupplyStockStatus = 'LOW_STOCK' | 'NORMAL';
export type SupplyTransactionType = 'IMPORT' | 'DISTRIBUTE' | 'RETURN';

// ─── Measurement unit ───────────────────────────────────────────────────────
// Fixed enum shared by Supply.unit and Medicine.unit — member names must
// match the backend's MeasurementUnit enum exactly (case-sensitive).

export type MeasurementUnit =
  | 'VIEN'
  | 'VI'
  | 'HOP'
  | 'CHAI'
  | 'ONG'
  | 'GOI'
  | 'TUYP'
  | 'LO'
  | 'CAI'
  | 'BO'
  | 'KHAC';

export const MEASUREMENT_UNIT_LABEL: Record<MeasurementUnit, string> = {
  VIEN: 'Viên',
  VI: 'Vỉ',
  HOP: 'Hộp',
  CHAI: 'Chai',
  ONG: 'Ống',
  GOI: 'Gói',
  TUYP: 'Tuýp',
  LO: 'Lọ',
  CAI: 'Cái',
  BO: 'Bộ',
  KHAC: 'Khác',
};

export const MEASUREMENT_UNIT_OPTIONS: { value: MeasurementUnit; label: string }[] = (
  Object.entries(MEASUREMENT_UNIT_LABEL) as [MeasurementUnit, string][]
).map(([value, label]) => ({ value, label }));

// ─── Supply categories ──────────────────────────────────────────────────────

export interface SupplyCategory {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplyCategoryRequest {
  name: string;
  description?: string;
}

export interface UpdateSupplyCategoryRequest {
  name?: string;
  description?: string;
}

// ─── Supplies ───────────────────────────────────────────────────────────────

export interface Supply {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  unit: MeasurementUnit;
  currentStock: number;
  minStockLevel: number;
  description: string | null;
  isActive: boolean;
  isLowStock: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyListResponse {
  items: Supply[];
  meta: PaginationMeta;
}

export interface CreateSupplyRequest {
  name: string;
  categoryId: string;
  unit: MeasurementUnit;
  description?: string;
  minStockLevel: number;
}

export interface UpdateSupplyRequest {
  name?: string;
  categoryId?: string;
  unit?: MeasurementUnit;
  description?: string;
  minStockLevel?: number;
  isActive?: boolean;
}

// ─── Transactions ───────────────────────────────────────────────────────────

export interface SupplyTransaction {
  id: string;
  supplyId: string;
  transactionType: SupplyTransactionType;
  quantity: number;
  roomId: string | null;
  roomName: string | null;
  note: string | null;
  actorName: string;
  createdAt: string;
}

export interface SupplyTransactionListResponse {
  items: SupplyTransaction[];
  meta: PaginationMeta;
}

// ─── Import ─────────────────────────────────────────────────────────────────

export interface ImportSupplyLine {
  supplyId: string;
  quantity: number;
  unitPrice: number;
  expiryDate?: string;
}

// Note: the backend's ImportSuppliesDto has no `note` field (only
// supplierId + items) even though this module's feature spec mentions one —
// omitted here to match the actual DTO exactly.
export interface ImportSuppliesRequest {
  supplierId: string;
  items: ImportSupplyLine[];
}

export interface SupplyImportItemResponse {
  supplyId: string;
  supplyName: string;
  unit: MeasurementUnit;
  quantity: number;
  unitPrice: number;
  expiryDate: string | null;
  batchNumber: string | null;
  currentStock: number;
}

export interface SupplyImportResponse {
  id: string;
  supplierId: string;
  importDate: string;
  totalValue: number | null;
  items: SupplyImportItemResponse[];
}

// ─── Distribute ─────────────────────────────────────────────────────────────

export interface DistributeSupplyRequest {
  supplyId: string;
  roomId: string;
  quantity: number;
}

export interface DistributeSupplyResponse {
  transactionId: string;
  supplyId: string;
  supplyName: string;
  unit: MeasurementUnit;
  roomId: string;
  roomName: string;
  quantity: number;
  currentStock: number;
  createdAt: string;
}
