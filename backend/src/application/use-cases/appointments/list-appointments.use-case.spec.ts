import { ListAppointmentsUseCase } from './list-appointments.use-case';
import { ListAppointmentsQueryDto } from '../../dtos/appointments/list-appointments-query.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { Patient } from '../../../domain/entities/patient.entity';
import { Gender } from '../../../domain/enums/gender.enum';
import { UserRole } from '../../../domain/enums/user-role.enum';

function buildQuery(overrides: Partial<ListAppointmentsQueryDto> = {}): ListAppointmentsQueryDto {
  const query = new ListAppointmentsQueryDto();
  Object.assign(query, { page: 1, limit: 20, ...overrides });
  return query;
}

function buildPatient(overrides: Partial<Patient> = {}): Patient {
  return new Patient(
    overrides.id ?? 'patient-1',
    overrides.patientCode ?? 'PT000001',
    overrides.fullName ?? 'Nguyen Van A',
    overrides.email ?? null,
    overrides.dateOfBirth ?? new Date('1990-01-01'),
    overrides.gender ?? Gender.MALE,
    overrides.phone ?? '0900000000',
    overrides.idCard ?? '000000000000',
    overrides.address ?? null,
    overrides.note ?? null,
    overrides.notificationConsent ?? true,
    overrides.userId ?? 'user-1',
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

describe('ListAppointmentsUseCase', () => {
  function buildUseCase(overrides?: { findByUserId?: jest.Mock; findMany?: jest.Mock }) {
    const appointmentRepository = {
      findMany: overrides?.findMany ?? jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const patientRepository = {
      findByUserId: overrides?.findByUserId ?? jest.fn().mockResolvedValue(buildPatient()),
    };

    const useCase = new ListAppointmentsUseCase(appointmentRepository as never, patientRepository as never);
    return { useCase, appointmentRepository, patientRepository };
  }

  it('applies the caller-supplied patientId filter for a staff actor (RECEPTIONIST)', async () => {
    const { useCase, appointmentRepository, patientRepository } = buildUseCase();

    await useCase.execute({
      query: buildQuery({ patientId: 'patient-42' }),
      actorId: 'receptionist-1',
      actorRole: UserRole.RECEPTIONIST,
    });

    expect(appointmentRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'patient-42' }),
    );
    // Staff actors never resolve "self" patient — the filter is used as-is.
    expect(patientRepository.findByUserId).not.toHaveBeenCalled();
  });

  // Alternative flow: a PATIENT caller's own patientId always wins over any
  // patientId the query string carries (IDOR protection), even if a
  // different patientId is passed in.
  it('force-scopes a PATIENT actor to their own resolved patientId, ignoring any patientId query param', async () => {
    const selfPatient = buildPatient({ id: 'patient-self' });
    const { useCase, appointmentRepository, patientRepository } = buildUseCase({
      findByUserId: jest.fn().mockResolvedValue(selfPatient),
    });

    await useCase.execute({
      query: buildQuery({ patientId: 'someone-elses-patient-id' }),
      actorId: 'user-1',
      actorRole: UserRole.PATIENT,
    });

    expect(patientRepository.findByUserId).toHaveBeenCalledWith('user-1');
    expect(appointmentRepository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'patient-self' }),
    );
  });

  it('throws ResourceNotFoundError when a PATIENT actor has no linked patient record', async () => {
    const { useCase } = buildUseCase({ findByUserId: jest.fn().mockResolvedValue(null) });

    await expect(
      useCase.execute({ query: buildQuery(), actorId: 'user-orphan', actorRole: UserRole.PATIENT }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
