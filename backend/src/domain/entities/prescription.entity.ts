export interface PrescriptionItemData {
  id: string;
  prescriptionId: string;
  medicineId: string;
  medicineName: string;
  activeIngredient: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instruction: string | null;
  allergyWarning: boolean;
  sortOrder: number;
}

export class Prescription {
  constructor(
    public readonly id: string,
    public readonly visitId: string,
    public readonly note: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly createdBy: string,
    public readonly items: PrescriptionItemData[],
  ) {}
}
