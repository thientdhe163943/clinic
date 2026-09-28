import type { PaginationMeta } from './api';

export interface SpecialtyOption {
  id: string;
  name: string;
  description: string | null;
}

export interface DoctorSpecialtyProfile {
  id: string | null;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  isActive: boolean;
  specialtyId: string | null;
  specialtyName: string | null;
  specialtyDescription: string | null;
  subspecialty: string | null;
  degree: string | null;
  certification: string | null;
  certificationFiles?: DoctorCertificationFile[];
  yearsExperience: number | null;
  biography: string | null;
  avatarUrl: string | null;
  approvalStatus: DoctorProfileApprovalStatus | null;
  pendingUpdate?: PendingDoctorSpecialtyUpdate | null;
  updatedAt: string | null;
}

export type DoctorProfileApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface DoctorCertificationFile {
  id: string;
  fileUrl: string;
  originalName: string | null;
  uploadedAt: string;
}

export interface PendingDoctorSpecialtyUpdate {
  id: string;
  specialtyId: string;
  specialtyName: string | null;
  subspecialty: string | null;
  degree: string | null;
  certification: string | null;
  certificationFileUrls: string[];
  yearsExperience: number | null;
  biography: string | null;
  avatarUrl: string | null;
  status: DoctorProfileApprovalStatus;
  submittedAt: string;
  rejectionReason: string | null;
}

export interface CreateSpecialtyRequest {
  name: string;
  description?: string;
}

export interface UpdateSpecialtyRequest {
  name?: string;
  description?: string;
}

export interface UpdateDoctorSpecialtyRequest {
  specialtyId: string;
  subspecialty?: string | null;
  degree?: string | null;
  certification?: string | null;
  certificationFileUrls?: string[] | null;
  yearsExperience?: number | null;
  biography?: string | null;
  avatarUrl?: string | null;
}

export interface ListDoctorSpecialtyProfilesQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListDoctorSpecialtyProfilesResponse {
  items: DoctorSpecialtyProfile[];
  meta: PaginationMeta;
  summary: {
    assigned: number;
    active: number;
  };
}
