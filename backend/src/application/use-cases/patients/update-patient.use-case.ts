import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { UpdatePatientRequestDto } from '../../dtos/patients/update-patient.dto';
import { PatientResponseDto, toPatientResponse } from '../../dtos/patients/patient-response.dto';
import { ConflictError, ResourceNotFoundError } from '../../errors/application-error';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { Patient } from '../../../domain/entities/patient.entity';

export interface UpdatePatientInput extends UpdatePatientRequestDto {
  id: string;
  actorId: string;
}

const TRACKED_FIELDS = [
  'fullName',
  'email',
  'dateOfBirth',
  'gender',
  'phone',
  'idCard',
  'address',
  'note',
  'notificationConsent',
] as const satisfies readonly (keyof Patient)[];

function serializeFieldValue(value: Patient[(typeof TRACKED_FIELDS)[number]]): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function diffPatientFields(before: Patient, after: Patient) {
  return TRACKED_FIELDS.filter((field) => serializeFieldValue(before[field]) !== serializeFieldValue(after[field])).map(
    (field) => ({
      fieldName: field,
      oldValue: serializeFieldValue(before[field]),
      newValue: serializeFieldValue(after[field]),
    }),
  );
}

@Injectable()
export class UpdatePatientUseCase {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdatePatientInput): Promise<PatientResponseDto> {
    const patient = await this.patientRepository.findById(input.id);
    if (!patient) throw new ResourceNotFoundError('Patient');

    if (input.email && input.email !== patient.email) {
      const existingEmail = await this.patientRepository.findByEmail(input.email);
      if (existingEmail && existingEmail.id !== patient.id) throw new ConflictError('Email', { field: 'email' });
    }

    if (input.idCard && input.idCard !== patient.idCard) {
      const existingIdCard = await this.patientRepository.findByIdCard(input.idCard);
      if (existingIdCard && existingIdCard.id !== patient.id) throw new ConflictError('CCCD/CMND', { field: 'idCard' });
    }

    const updated = await this.patientRepository.update(patient.id, {
      fullName: input.fullName,
      email: input.email,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      phone: input.phone,
      idCard: input.idCard,
      address: input.address,
      note: input.note,
      notificationConsent: input.notificationConsent,
      updatedBy: input.actorId,
    });

    // Feature 14 requires per-field old/new value tracking on every update —
    // captured in system_logs.detail instead of a dedicated table (spec's
    // "field/old value/new value/time/actor" maps 1:1 onto SystemLog's
    // existing columns + JSON detail).
    const changes = diffPatientFields(patient, updated);

    await this.auditLog.write({
      userId: input.actorId,
      action: 'UPDATE',
      module: 'PATIENT',
      targetId: updated.id,
      detail: { patientCode: updated.patientCode, changes },
    });

    return toPatientResponse(updated);
  }
}
