import { UserRole } from '../../../domain/enums/user-role.enum';

export class AdminUserResponseDto {
  id!: string;
  fullName!: string;
  email!: string | null;
  phone!: string;
  idCard!: string | null;
  role!: UserRole;
  isActive!: boolean;
  mustChangePassword!: boolean;
  lockedAt!: Date | null;
  lastLoginAt!: Date | null;
  specialtyId!: string | null;
  specialtyName!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
