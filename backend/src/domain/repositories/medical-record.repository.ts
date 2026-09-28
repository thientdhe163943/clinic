import { MedicalRecord } from '../entities/medical-record.entity';
import { Gender } from '../enums/gender.enum';
import { UserRole } from '../enums/user-role.enum';

export const MEDICAL_RECORD_REPOSITORY = Symbol('MEDICAL_RECORD_REPOSITORY');

export interface MedicalRecordListQuery {
  search?: string;
  skip: number;
  take: number;
  actorId: string;
  actorRole: UserRole;
}

export interface MedicalRecordListItem {
  patientId: string;
  patientCode: string;
  fullName: string;
  email: string | null;
  phone: string;
  totalVisits: number;
  updatedAt: Date | null;
}

export interface MedicalRecordListResult {
  data: MedicalRecordListItem[];
  total: number;
}

export interface MedicalRecordPatientInfo {
  id: string;
  patientCode: string;
  fullName: string;
  email: string | null;
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  idCard: string;
  address: string | null;
  note: string | null;
  notificationConsent: boolean;
}

export interface MedicalRecordAllergy {
  id: string;
  allergen: string;
  severity: string;
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
  createdAt: Date;
  completedAt: Date | null;
  diagnosis: string | null;
  clinicalNote: string | null;
  treatmentResult: string | null;
  followUpDate: Date | null;
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
      uploadedAt: Date;
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
  record: MedicalRecord | null;
  allergies: MedicalRecordAllergy[];
  visits: MedicalRecordVisit[];
}

export interface MedicalRecordUpdateData {
  patientId: string;
  medicalHistory?: string | null;
  clinicalNote?: string | null;
  diagnosisSummary?: string | null;
  treatmentSummary?: string | null;
  followUpNote?: string | null;
  updatedBy: string;
}

export interface ReplaceMedicalRecordAllergiesData {
  patientId: string;
  allergies: Array<{
    allergen: string;
    severity: string;
    description?: string | null;
  }>;
  createdBy: string;
}

export interface MedicalRecordRepository {
  findMany(query: MedicalRecordListQuery): Promise<MedicalRecordListResult>;
  findDetail(patientId: string): Promise<MedicalRecordDetail | null>;
  findByPatientId(patientId: string): Promise<MedicalRecord | null>;
  hasDoctorVisit(patientId: string, doctorId: string, activeOnly?: boolean): Promise<boolean>;
  upsertByPatientId(data: MedicalRecordUpdateData): Promise<MedicalRecord>;
  replaceAllergies(data: ReplaceMedicalRecordAllergiesData): Promise<MedicalRecordAllergy[]>;
}
