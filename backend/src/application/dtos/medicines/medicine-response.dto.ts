import { PaginationMeta } from '../pagination.dto';

export interface MedicineResponseDto {
  id: string;
  name: string;
  activeIngredient: string;
  dosageForm: string;
  unit: string;
  price: number | null;
  description: string | null;
  contraindications: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineListResponseDto {
  items: MedicineResponseDto[];
  meta: PaginationMeta;
}
