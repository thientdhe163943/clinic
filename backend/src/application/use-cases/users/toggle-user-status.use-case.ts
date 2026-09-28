import { Inject, Injectable } from '@nestjs/common';
import { AdminUserResponseDto } from '../../dtos/users/admin-user-response.dto';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { ForbiddenActionError, ResourceNotFoundError } from '../../errors/application-error';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';

@Injectable()
export class ToggleUserStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(userId: string): Promise<AdminUserResponseDto> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) throw new ResourceNotFoundError('User');

    // Business Rule (2026-07-22): staff-only user management — patient
    // accounts must not be activated/deactivated through this admin endpoint.
    if (existing.role === UserRole.PATIENT) throw new ForbiddenActionError();

    const user = await this.userRepository.update(userId, {
      isActive: !existing.isActive,
      // When re-activating, also clear any lock
      ...(existing.isActive === false ? { lockedAt: null, failedLoginCount: 0 } : {}),
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
