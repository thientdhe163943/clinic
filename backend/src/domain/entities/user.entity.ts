import { UserRole } from '../enums/user-role.enum';

export class User {
  constructor(
    public readonly id: string,
    public readonly fullName: string,
    public readonly email: string | null,
    public readonly phone: string,
    public readonly passwordHash: string,
    public readonly role: UserRole,
    public readonly isActive: boolean,
    public readonly mustChangePassword: boolean,
    public readonly failedLoginCount: number,
    public readonly lockedAt: Date | null,
    public readonly lastLoginAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly idCard: string | null = null,
    // Non-doctor staff (NURSE / LAB_TECH / RECEPTIONIST) department grouping,
    // for room-picker filtering only. See DoctorProfile.specialtyId for the
    // doctor equivalent (which is load-bearing for the booking flow).
    public readonly specialtyId: string | null = null,
  ) {}
}
