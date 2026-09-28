import * as bcrypt from 'bcrypt';
import { CreateUserUseCase } from './create-user.use-case';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { DEFAULT_STAFF_PASSWORD } from '../../../domain/value-objects/password-policy.vo';
import { ConflictError } from '../../errors/application-error';

function buildUser(overrides: Partial<User> = {}): User {
  return new User(
    overrides.id ?? 'user-1',
    overrides.fullName ?? 'Nguyen Van B',
    overrides.email ?? 'b@example.com',
    overrides.phone ?? '0900000001',
    overrides.passwordHash ?? 'hash',
    overrides.role ?? UserRole.RECEPTIONIST,
    overrides.isActive ?? true,
    overrides.mustChangePassword ?? true,
    overrides.failedLoginCount ?? 0,
    overrides.lockedAt ?? null,
    overrides.lastLoginAt ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.idCard ?? null,
    overrides.specialtyId ?? null,
  );
}

describe('CreateUserUseCase', () => {
  function buildUseCase(overrides?: {
    findByEmail?: jest.Mock;
    findByPhone?: jest.Mock;
    findByIdCard?: jest.Mock;
    create?: jest.Mock;
    createdUser?: User;
  }) {
    const createdUser = overrides?.createdUser ?? buildUser();
    const userRepository = {
      findById: jest.fn(),
      findByEmail: overrides?.findByEmail ?? jest.fn().mockResolvedValue(null),
      findByPhone: overrides?.findByPhone ?? jest.fn().mockResolvedValue(null),
      findByIdCard: overrides?.findByIdCard ?? jest.fn().mockResolvedValue(null),
      findByEmailOrPhone: jest.fn(),
      findAll: jest.fn(),
      countAll: jest.fn(),
      create: overrides?.create ?? jest.fn().mockResolvedValue(createdUser),
      update: jest.fn(),
      findDoctorsBySpecialty: jest.fn(),
    };
    const specialtyRepository = {
      findById: jest.fn().mockResolvedValue(null),
      findByIds: jest.fn().mockResolvedValue([]),
    };

    const useCase = new CreateUserUseCase(userRepository as never, specialtyRepository as never);
    return { useCase, userRepository, specialtyRepository, createdUser };
  }

  it('creates a staff account with the shared default password and mustChangePassword=true', async () => {
    const { useCase, userRepository } = buildUseCase();

    await useCase.execute(
      {
        fullName: 'Nguyen Van B',
        email: 'b@example.com',
        phone: '0900000001',
        role: UserRole.RECEPTIONIST,
      },
      'admin-1',
    );

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: UserRole.RECEPTIONIST, mustChangePassword: true }),
    );
    const createArg = userRepository.create.mock.calls[0][0];
    // Never trust an admin-typed password anymore — hash must match DEFAULT_STAFF_PASSWORD.
    await expect(bcrypt.compare(DEFAULT_STAFF_PASSWORD, createArg.passwordHash)).resolves.toBe(true);
  });

  it('passes specialtyId through to the repository and denormalizes specialtyName in the response', async () => {
    const createdUser = buildUser({ specialtyId: 'specialty-1' });
    const { useCase, userRepository, specialtyRepository } = buildUseCase({ createdUser });
    specialtyRepository.findById.mockResolvedValue({ id: 'specialty-1', name: 'Nội tổng quát' });

    const result = await useCase.execute(
      {
        fullName: 'Nguyen Van B',
        email: 'b@example.com',
        phone: '0900000001',
        role: UserRole.NURSE,
        specialtyId: 'specialty-1',
      },
      'admin-1',
    );

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ specialtyId: 'specialty-1' }),
    );
    expect(result.specialtyId).toBe('specialty-1');
    expect(result.specialtyName).toBe('Nội tổng quát');
  });

  // Alternative flow (A1): email already exists.
  it('throws ConflictError when the email already belongs to another user', async () => {
    const { useCase } = buildUseCase({ findByEmail: jest.fn().mockResolvedValue(buildUser()) });

    await expect(
      useCase.execute(
        {
          fullName: 'Nguyen Van B',
          email: 'b@example.com',
          phone: '0900000001',
          role: UserRole.RECEPTIONIST,
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
