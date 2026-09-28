import { Injectable } from '@nestjs/common';
import { Prisma, User as PrismaUser } from '@prisma/client';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { CreateUserData, UserFilters, UserRepository, UserUpdateData } from '../../../domain/repositories/user.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { phone, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdCard(idCard: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({ where: { idCard, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmailOrPhone(identifier: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { deletedAt: null, OR: [{ email: identifier }, { phone: identifier }] },
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(filters: UserFilters, skip: number, take: number): Promise<User[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => this.toDomain(r));
  }

  async countAll(filters: UserFilters): Promise<number> {
    return this.prisma.user.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(filters: UserFilters): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search } },
        { email: { contains: filters.search } },
        { phone: { contains: filters.search } },
      ];
    }

    if (filters.role) {
      where.role = filters.role;
    } else if (filters.excludeRoles?.length) {
      where.role = { notIn: filters.excludeRoles };
    }
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isLocked === true) where.lockedAt = { not: null };
    if (filters.isLocked === false) where.lockedAt = null;

    return where;
  }

  async create(data: CreateUserData): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role,
        mustChangePassword: data.mustChangePassword,
        idCard: data.idCard,
        specialtyId: data.specialtyId ?? null,
      },
    });

    return this.toDomain(row);
  }

  async update(id: string, data: UserUpdateData): Promise<User> {
    const row = await this.prisma.user.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        passwordHash: data.passwordHash,
        role: data.role,
        isActive: data.isActive,
        mustChangePassword: data.mustChangePassword,
        failedLoginCount: data.failedLoginCount,
        lockedAt: data.lockedAt,
        lastLoginAt: data.lastLoginAt,
        idCard: data.idCard,
        ...(data.specialtyId !== undefined && { specialtyId: data.specialtyId }),
      },
    });

    return this.toDomain(row);
  }

  async findDoctorsBySpecialty(specialtyId: string): Promise<User[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        role: UserRole.DOCTOR,
        doctorProfile: { specialtyId },
      },
    });
    return rows.map((row) => this.toDomain(row));
  }

  private toDomain(row: PrismaUser): User {
    return new User(
      row.id,
      row.fullName,
      row.email,
      row.phone,
      row.passwordHash,
      row.role as UserRole,
      row.isActive,
      row.mustChangePassword,
      row.failedLoginCount,
      row.lockedAt,
      row.lastLoginAt,
      row.createdAt,
      row.updatedAt,
      row.idCard,
      row.specialtyId,
    );
  }
}
