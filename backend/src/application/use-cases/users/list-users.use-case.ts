import { Inject, Injectable } from '@nestjs/common';
import { AdminUserResponseDto } from '../../dtos/users/admin-user-response.dto';
import { ListUsersQueryDto } from '../../dtos/users/list-users-query.dto';
import { UserFilters, USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { buildPaginationMeta, PaginationMeta } from '../../dtos/pagination.dto';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';

export interface ListUsersResult {
  items: AdminUserResponseDto[];
  meta: PaginationMeta;
}

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(query: ListUsersQueryDto): Promise<ListUsersResult> {
    const filters: UserFilters = {
      search: query.search,
      role: query.role,
      excludeRoles: [UserRole.ADMIN, UserRole.PATIENT],
    };

    if (query.status === 'active') {
      filters.isActive = true;
      filters.isLocked = false;
    } else if (query.status === 'inactive') {
      filters.isActive = false;
    } else if (query.status === 'locked') {
      filters.isActive = true;
      filters.isLocked = true;
    }

    const [users, total] = await Promise.all([
      this.userRepository.findAll(filters, query.skip, query.limit),
      this.userRepository.countAll(filters),
    ]);

    const specialtyIds = [...new Set(users.map((u) => u.specialtyId).filter((id): id is string => !!id))];
    const specialties = await this.specialtyRepository.findByIds(specialtyIds);
    const specialtyNameById = new Map(specialties.map((s) => [s.id, s.name]));

    return {
      items: users.map((u) => this.toDto(u, specialtyNameById)),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  private toDto(user: User, specialtyNameById: Map<string, string>): AdminUserResponseDto {
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
      specialtyName: (user.specialtyId && specialtyNameById.get(user.specialtyId)) ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
