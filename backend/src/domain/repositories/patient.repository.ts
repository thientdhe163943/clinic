import { Gender } from '../enums/gender.enum';
import { Patient } from '../entities/patient.entity';

export const PATIENT_REPOSITORY = Symbol('PATIENT_REPOSITORY');

export interface CreatePatientData {
  patientCode: string;
  fullName: string;
  email?: string | null;
  dateOfBirth: Date;
  gender: Gender;
  phone: string;
  idCard?: string | null;
  address?: string | null;
  note?: string | null;
  notificationConsent?: boolean;
  userId?: string | null;
  createdBy: string;
}

export interface PatientUpdateData {
  fullName?: string;
  email?: string | null;
  dateOfBirth?: Date;
  gender?: Gender;
  phone?: string;
  idCard?: string;
  address?: string | null;
  note?: string | null;
  notificationConsent?: boolean;
  updatedBy?: string | null;
}

export interface PatientListQuery {
  search?: string;
  skip: number;
  take: number;
}

export interface PatientListResult {
  data: Patient[];
  total: number;
}

export interface PatientRepository {
  findById(id: string): Promise<Patient | null>;
  findByPhone(phone: string): Promise<Patient | null>;
  findByEmail(email: string): Promise<Patient | null>;
  findByIdCard(idCard: string): Promise<Patient | null>;
  findByUserId(userId: string): Promise<Patient | null>;
  findMany(query: PatientListQuery): Promise<PatientListResult>;
  create(data: CreatePatientData): Promise<Patient>;
  update(id: string, data: PatientUpdateData): Promise<Patient>;
  linkUser(id: string, userId: string): Promise<Patient>;
}
