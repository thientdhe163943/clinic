import { Prescription } from '../entities/prescription.entity';

export const PRESCRIPTION_REPOSITORY = Symbol('PRESCRIPTION_REPOSITORY');

export interface CreatePrescriptionItemData {
  medicineId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instruction?: string | null;
  allergyWarning: boolean;
  sortOrder: number;
}

export interface CreatePrescriptionData {
  visitId: string;
  note?: string | null;
  createdBy: string;
  items: CreatePrescriptionItemData[];
}

export interface PrescriptionWithDetails extends Prescription {
  patientName: string;
  patientCode: string;
  patientDateOfBirth: Date;
  doctorName: string;
  appointmentTime: Date;
}

export interface UpdatePrescriptionData {
  note?: string | null;
  items: CreatePrescriptionItemData[];
}

export interface PrescriptionRepository {
  findByVisitId(visitId: string): Promise<Prescription | null>;
  findWithDetailsById(id: string): Promise<PrescriptionWithDetails | null>;
  create(data: CreatePrescriptionData): Promise<Prescription>;
  update(id: string, data: UpdatePrescriptionData): Promise<Prescription>;
}
