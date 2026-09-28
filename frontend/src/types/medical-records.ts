import type { PaginationMeta } from './api';
import type { Gender } from './patients';

export type AllergySeverity = 'MILD' | 'MODERATE' | 'SEVERE';

export interface MedicalRecordListItem {
  patientId: string;
  patientCode: string;
  fullName: string;
  email: string | null;
  phone: string;
  totalVisits: number;
  updatedAt: string | null;
}

export interface MedicalRecordListResponse {
  items: MedicalRecordListItem[];
  meta: PaginationMeta;
}

export interface MedicalRecordQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface MedicalRecordPatientInfo {
  id: string;
  patientCode: string;
  fullName: string;
  email: string | null;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  idCard: string | null;
  address: string | null;
  note: string | null;
  notificationConsent: boolean;
}

export interface MedicalRecordBase {
  id: string;
  patientId: string;
  medicalHistory: string | null;
  clinicalNote: string | null;
  diagnosisSummary: string | null;
  treatmentSummary: string | null;
  followUpNote: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string | null;
}

export interface MedicalRecordAllergy {
  id: string;
  allergen: string;
  severity: AllergySeverity;
  description: string | null;
}

export interface MedicalRecordVisit {
  id: string;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  roomName: string;
  serviceName: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  diagnosis: string | null;
  clinicalNote: string | null;
  treatmentResult: string | null;
  followUpDate: string | null;
  paraclinicalResults: Array<{
    id: string;
    serviceName: string;
    status: string;
    summary: string | null;
    resultData: unknown;
    attachments: Array<{
      id: string;
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSizeKb: number | null;
      uploadedAt: string;
    }>;
  }>;
  prescriptions: Array<{
    id: string;
    medicineName: string;
    dosage: string;
    frequency: string;
    durationDays: number;
    instruction: string | null;
  }>;
}

export interface MedicalRecordDetail {
  patient: MedicalRecordPatientInfo;
  record: MedicalRecordBase | null;
  allergies: MedicalRecordAllergy[];
  visits: MedicalRecordVisit[];
}

export interface MedicalRecordPrintView {
  patient: MedicalRecordPatientInfo;
  allergies: MedicalRecordAllergy[];
  visits: MedicalRecordVisit[];
}

export interface UpdateMedicalRecordRequest {
  medicalHistory?: string;
  clinicalNote?: string;
  diagnosisSummary?: string;
  treatmentSummary?: string;
  followUpNote?: string;
  allergies?: Array<{
    allergen: string;
    severity: AllergySeverity;
    description?: string;
  }>;
}
