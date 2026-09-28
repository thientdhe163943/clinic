import { User } from '../entities/user.entity';
import { UserRole } from '../enums/user-role.enum';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserUpdateData {
  fullName?: string;
  // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
  email?: string | null;
  phone?: string;
  passwordHash?: string;
  role?: UserRole;
  isActive?: boolean;
  mustChangePassword?: boolean;
  failedLoginCount?: number;
  lockedAt?: Date | null;
  lastLoginAt?: Date | null;
  idCard?: string | null;
  // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
  specialtyId?: string | null;
}

export interface CreateUserData {
  fullName: string;
  email: string | null;
  phone: string;
  passwordHash: string;
  role: UserRole;
  mustChangePassword: boolean;
  idCard?: string | null;
  specialtyId?: string | null;
}

export interface UserFilters {
  search?: string;
  role?: UserRole;
  excludeRoles?: UserRole[];
  isActive?: boolean;
  isLocked?: boolean;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  findByIdCard(idCard: string): Promise<User | null>;
  // Login accepts either an email or a phone number as the username.
  findByEmailOrPhone(identifier: string): Promise<User | null>;
  findAll(filters: UserFilters, skip: number, take: number): Promise<User[]>;
  countAll(filters: UserFilters): Promise<number>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UserUpdateData): Promise<User>;
  /** Returns active DOCTOR users whose doctor_profiles.specialty_id matches. */
  findDoctorsBySpecialty(specialtyId: string): Promise<User[]>;
}
