export interface SpecialtyOptionResponseDto {
  id: string;
  name: string;
  description: string | null;
}

export interface DoctorSpecialtyProfileResponseDto {
  id: string | null;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string;
  isActive: boolean;
  specialtyId: string | null;
  specialtyName: string | null;
  specialtyDescription: string | null;
  subspecialty: string | null;
  degree: string | null;
  certification: string | null;
  certificationFiles?: DoctorCertificationFileResponseDto[];
  yearsExperience: number | null;
  biography: string | null;
  avatarUrl: string | null;
  approvalStatus: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | null;
  pendingUpdate?: PendingDoctorSpecialtyUpdateResponseDto | null;
  updatedAt: string | null;
}

export interface DoctorCertificationFileResponseDto {
  id: string;
  fileUrl: string;
  originalName: string | null;
  uploadedAt: string;
}

export interface PendingDoctorSpecialtyUpdateResponseDto {
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
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  rejectionReason: string | null;
}
