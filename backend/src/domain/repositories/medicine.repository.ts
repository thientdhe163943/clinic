import { Medicine } from '../entities/medicine.entity';
import { MeasurementUnit } from '../enums/measurement-unit.enum';

export const MEDICINE_REPOSITORY = Symbol('MEDICINE_REPOSITORY');

export interface MedicineListFilter {
  search?: string;
  /** true => chỉ trả thuốc isActive (dùng cho danh sách kê đơn của bác sĩ). */
  onlyActive?: boolean;
  page: number;
  limit: number;
}

export interface CreateMedicineData {
  name: string;
  activeIngredient: string;
  dosageForm: string;
  unit: MeasurementUnit;
  price?: number | null;
  contraindications?: string | null;
  description?: string | null;
  createdBy: string;
}

export interface UpdateMedicineData {
  name?: string;
  activeIngredient?: string;
  dosageForm?: string;
  unit?: MeasurementUnit;
  price?: number | null;
  contraindications?: string | null;
  description?: string | null;
  isActive?: boolean;
  updatedBy: string;
}

export interface MedicineRepository {
  findById(id: string): Promise<Medicine | null>;
  findByName(name: string): Promise<Medicine | null>;
  findMany(filter: MedicineListFilter): Promise<{ items: Medicine[]; total: number }>;
  create(data: CreateMedicineData): Promise<Medicine>;
  update(id: string, data: UpdateMedicineData): Promise<Medicine>;
  softDelete(id: string, deletedBy: string): Promise<void>;
  /** Returns true if the medicine is referenced by any prescription item. */
  isInUse(id: string): Promise<boolean>;
}
