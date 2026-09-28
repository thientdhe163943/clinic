import { Inject, Injectable } from '@nestjs/common';
import { AdminUserResponseDto } from '../../dtos/users/admin-user-response.dto';
import { UpdateUserDto } from '../../dtos/users/update-user.dto';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { ConflictError, ForbiddenActionError, ResourceNotFoundError } from '../../errors/application-error';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(userId: string, dto: UpdateUserDto): Promise<AdminUserResponseDto> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) throw new ResourceNotFoundError('User');

    // Business Rule (2026-07-22): staff-only user management — patient
    // accounts (created via the walk-in registration flow) must not be
    // editable through this admin endpoint.
    if (existing.role === UserRole.PATIENT) throw new ForbiddenActionError();

    if (dto.email && dto.email !== existing.email) {
      const byEmail = await this.userRepository.findByEmail(dto.email);
      if (byEmail) throw new ConflictError('Email');
    }

    if (dto.phone && dto.phone !== existing.phone) {
      const byPhone = await this.userRepository.findByPhone(dto.phone);
      if (byPhone) throw new ConflictError('Số điện thoại');
    }

    if (dto.idCard && dto.idCard !== existing.idCard) {
      const byIdCard = await this.userRepository.findByIdCard(dto.idCard);
      if (byIdCard) throw new ConflictError('CCCD/CMND');
    }

    const user = await this.userRepository.update(userId, {
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      role: dto.role,
      idCard: dto.idCard,
      // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
      specialtyId: dto.specialtyId,
    });

    return this.toDto(user);
  }

  private async toDto(user: User): Promise<AdminUserResponseDto> {
    const specialty = user.specialtyId ? await this.specialtyRepository.findById(user.specialtyId) : null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      idCard: user.idCard,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lockedAt: user.lockedAt,
      lastLoginAt: user.lastLoginAt,
      specialtyId: user.specialtyId,
      specialtyName: specialty?.name ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
