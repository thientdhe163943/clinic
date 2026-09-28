import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AdminUserResponseDto } from '../../dtos/users/admin-user-response.dto';
import { CreateUserDto } from '../../dtos/users/create-user.dto';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { ConflictError } from '../../errors/application-error';
import { DEFAULT_STAFF_PASSWORD } from '../../../domain/value-objects/password-policy.vo';
import { User } from '../../../domain/entities/user.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(dto: CreateUserDto, _createdBy: string): Promise<AdminUserResponseDto> {
    const [byEmail, byPhone] = await Promise.all([
      this.userRepository.findByEmail(dto.email),
      this.userRepository.findByPhone(dto.phone),
    ]);
    if (byEmail) throw new ConflictError('Email');
    if (byPhone) throw new ConflictError('Số điện thoại');

    if (dto.idCard) {
      const byIdCard = await this.userRepository.findByIdCard(dto.idCard);
      if (byIdCard) throw new ConflictError('CCCD/CMND');
    }

    // Business Rule (changed 2026-07-22): admin no longer types a password —
    // every staff account starts with the same fixed system default and
    // mustChangePassword: true forces them to set their own on first login.
    const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, BCRYPT_ROUNDS);

    const user = await this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
      mustChangePassword: true,
      idCard: dto.idCard,
      specialtyId: dto.specialtyId ?? null,
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
