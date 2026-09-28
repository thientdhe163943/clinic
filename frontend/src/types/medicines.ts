import type { PaginationMeta } from './api';
import type { MeasurementUnit } from './supplies';

// Rich admin-management shape for Feature 70-73 (Quản lý thuốc). Deliberately
// separate from the lightweight `Medicine` type in `types/visits.ts`, which
// backs the doctor prescribing flow's medicine-search picker and must stay
// untouched.
export interface AdminMedicine {
  id: string;
  name: string;
  activeIngredient: string;
  dosageForm: string;
  unit: MeasurementUnit;
  price: number | null;
  description: string | null;
  contraindications: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminMedicineListResponse {
  items: AdminMedicine[];
  meta: PaginationMeta;
}

export interface CreateMedicineRequest {
  name: string;
  activeIngredient: string;
  dosageForm: string;
  unit: MeasurementUnit;
  price: number;
  description?: string;
  contraindications?: string;
}

export interface UpdateMedicineRequest {
  name?: string;
  activeIngredient?: string;
  dosageForm?: string;
  unit?: MeasurementUnit;
  price?: number;
  description?: string;
  contraindications?: string;
  isActive?: boolean;
}
