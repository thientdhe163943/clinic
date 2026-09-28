import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { ForbiddenActionError, ResourceNotFoundError } from '../../errors/application-error';
import { DEFAULT_STAFF_PASSWORD } from '../../../domain/value-objects/password-policy.vo';
import { UserRole } from '../../../domain/enums/user-role.enum';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class ResetUserPasswordUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<void> {
    const existing = await this.userRepository.findById(userId);
    if (!existing) throw new ResourceNotFoundError('User');

    // Business Rule (2026-07-22): staff-only user management — patient
    // accounts must not be reset through this admin endpoint.
    if (existing.role === UserRole.PATIENT) throw new ForbiddenActionError();

    // Business Rule (changed 2026-07-22): reset always lands on the same
    // fixed system default password (no admin-typed password) — the staff
    // member is forced to set their own on next login.
    const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, BCRYPT_ROUNDS);

    await this.userRepository.update(userId, {
      passwordHash,
      mustChangePassword: true,
      lockedAt: null,
      failedLoginCount: 0,
    });
  }
}
