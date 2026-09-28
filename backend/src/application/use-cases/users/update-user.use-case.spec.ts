import { UpdateUserUseCase } from './update-user.use-case';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { ForbiddenActionError, ResourceNotFoundError } from '../../errors/application-error';

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'user-1',
    overrides.fullName ?? 'Nguyen Van B',
    overrides.email ?? 'b@example.com',
    overrides.phone ?? '0900000001',
    overrides.passwordHash ?? 'hash',
    overrides.role ?? UserRole.RECEPTIONIST,
    overrides.isActive ?? true,
    overrides.mustChangePassword ?? false,
    overrides.failedLoginCount ?? 0,
    overrides.lockedAt ?? null,
    overrides.lastLoginAt ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.idCard ?? null,
    overrides.specialtyId ?? null,
  );
}

describe('UpdateUserUseCase', () => {
  function buildUseCase(existing: User | null) {
    const userRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByPhone: jest.fn().mockResolvedValue(null),
      findByIdCard: jest.fn().mockResolvedValue(null),
      findByEmailOrPhone: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockImplementation((_id, data) =>
        // Mirror the repository-layer convention: `undefined` = leave
        // unchanged, an explicit `null` still overwrites.
        Promise.resolve(
          buildUser({
            ...existing,
            ...data,
            specialtyId: data.specialtyId !== undefined ? data.specialtyId : existing?.specialtyId ?? null,
          }),
        ),
      ),
      findDoctorsBySpecialty: jest.fn(),
    };
    const specialtyRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByIds: jest.fn().mockResolvedValue([]),
    };

    const useCase = new UpdateUserUseCase(userRepository as never, specialtyRepository as never);
    return { useCase, userRepository, specialtyRepository };
  }

  it('updates a staff account fullName/email/phone/role', async () => {
    const existing = buildUser({ id: 'user-1', role: UserRole.RECEPTIONIST });
    const { useCase, userRepository } = buildUseCase(existing);

    const result = await useCase.execute('user-1', {
      fullName: 'Nguyen Van B Updated',
      role: UserRole.NURSE,
    });

    expect(result.fullName).toBe('Nguyen Van B Updated');
    expect(result.role).toBe(UserRole.NURSE);
    expect(userRepository.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ fullName: 'Nguyen Van B Updated', role: UserRole.NURSE }),
    );
  });

  it('clears specialtyId when explicitly passed null, but leaves it unchanged when omitted', async () => {
    const existing = buildUser({ id: 'user-1', specialtyId: 'specialty-1' });
    const { useCase, userRepository } = buildUseCase(existing);

    // Omitted -> unchanged.
    const unchanged = await useCase.execute('user-1', { fullName: 'Same specialty' });
    expect(unchanged.specialtyId).toBe('specialty-1');

    // Explicit null -> cleared.
    const cleared = await useCase.execute('user-1', { specialtyId: null });
    expect(userRepository.update).toHaveBeenLastCalledWith(
      'user-1',
      expect.objectContaining({ specialtyId: null }),
    );
    expect(cleared.specialtyId).toBeNull();
  });

  // Alternative flow: staff-only user management — patient accounts must
  // not be editable through this admin endpoint (Business Rule, 2026-07-22).
  it('throws ForbiddenActionError when the target user is a PATIENT', async () => {
    const existing = buildUser({ id: 'user-2', role: UserRole.PATIENT });
    const { useCase } = buildUseCase(existing);

    await expect(useCase.execute('user-2', { fullName: 'New Name' })).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('throws ResourceNotFoundError when the user does not exist', async () => {
    const { useCase } = buildUseCase(null);

    await expect(useCase.execute('missing-id', { fullName: 'X' })).rejects.toBeInstanceOf(
      ResourceNotFoundError,
    );
  });
});
