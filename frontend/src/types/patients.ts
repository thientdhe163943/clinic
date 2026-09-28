import type { PaginationMeta } from './api';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export interface PatientProfile {
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
  userId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientListResponse {
  items: PatientProfile[];
  meta: PaginationMeta;
}

export interface PatientQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreatePatientRequest {
  fullName: string;
  // Genuinely optional, in create mode too (2026-08-07) — phone + idCard
  // (both mandatory) already work as login identifiers on their own, see
  // LoginUseCase.
  email?: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  idCard?: string;
  address?: string;
  note?: string;
  notificationConsent?: boolean;
}

export type UpdatePatientRequest = Partial<CreatePatientRequest>;
