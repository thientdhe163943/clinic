import { Prescription, PrescriptionItemData } from '../../../domain/entities/prescription.entity';

export interface PrescriptionItemResponseDto {
  id: string;
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

export interface PrescriptionResponseDto {
  id: string;
  visitId: string;
  note: string | null;
  createdAt: Date;
  items: PrescriptionItemResponseDto[];
}

export interface PrescriptionPrintDto extends PrescriptionResponseDto {
  patientName: string;
  patientCode: string;
  patientDateOfBirth: Date;
  doctorName: string;
  appointmentTime: Date;
}

function toItemResponse(item: PrescriptionItemData): PrescriptionItemResponseDto {
  return {
    id: item.id,
    medicineId: item.medicineId,
    medicineName: item.medicineName,
    activeIngredient: item.activeIngredient,
    dosage: item.dosage,
    frequency: item.frequency,
    durationDays: item.durationDays,
    instruction: item.instruction,
    allergyWarning: item.allergyWarning,
    sortOrder: item.sortOrder,
  };
}

export function toPrescriptionResponse(prescription: Prescription): PrescriptionResponseDto {
  return {
    id: prescription.id,
    visitId: prescription.visitId,
    note: prescription.note,
    createdAt: prescription.createdAt,
    items: prescription.items.map(toItemResponse),
  };
}
