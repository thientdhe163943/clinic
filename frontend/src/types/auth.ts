export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR' | 'NURSE' | 'LAB_TECH' | 'PATIENT';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

// Access/refresh tokens are set as httpOnly cookies by the backend and never
// appear in this response body.
export interface LoginResponse {
  role: UserRole;
  mustChangePassword: boolean;
  user: AuthUser;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  idCard: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  username: string;
}

export interface VerifyOtpRequest {
  username: string;
  otpCode: string;
}

export interface ResetPasswordRequest {
  username: string;
  otpCode: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  idCard: string | null;
  role: UserRole;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface AdminUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  idCard: string | null;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  lockedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  // NURSE/LAB_TECH/RECEPTIONIST are grouped by specialty directly via this
  // field on the base User record. DOCTOR's specialty lives on DoctorProfile
  // instead (see types/doctor-specialties.ts) — the /users list endpoint
  // does not resolve it, so this stays null for DOCTOR rows there.
  specialtyId?: string | null;
  specialtyName?: string | null;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  idCard?: string | null;
  specialtyId?: string | null;
}

export interface UpdateUserRequest {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  idCard?: string | null;
  specialtyId?: string | null;
}

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole | '';
  status?: 'active' | 'inactive' | 'locked' | '';
}
