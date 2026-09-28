import { Inject, Injectable } from '@nestjs/common';
import { CreatePrescriptionDto, CreatePrescriptionItemDto } from '../../dtos/prescriptions/create-prescription.dto';
import { PrescriptionPrintDto, toPrescriptionResponse } from '../../dtos/prescriptions/prescription-response.dto';
import {
  MedicineNotFoundError,
  PrescriptionExistsError,
  VisitNotFoundError,
  VisitNotInProgressError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PRESCRIPTION_REPOSITORY, PrescriptionRepository } from '../../../domain/repositories/prescription.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { APPOINTMENT_REPOSITORY, AppointmentRepository } from '../../../domain/repositories/appointment.repository';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface CreatePrescriptionInput extends CreatePrescriptionDto {
  visitId: string;
  actorId: string;
}

export interface MedicineInfo {
  id: string;
  name: string;
  activeIngredient: string;
}

export interface AllergyWarningResult {
  medicineId: string;
  hasAllergyWarning: boolean;
}

@Injectable()
export class CreatePrescriptionUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PRESCRIPTION_REPOSITORY) private readonly prescriptionRepository: PrescriptionRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(APPOINTMENT_REPOSITORY) private readonly appointmentRepository: AppointmentRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: CreatePrescriptionInput): Promise<PrescriptionPrintDto> {
    const visit = await this.visitRepository.findById(input.visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.IN_PROGRESS) throw new VisitNotInProgressError();

    const existing = await this.prescriptionRepository.findByVisitId(input.visitId);
    if (existing) throw new PrescriptionExistsError();

    // Load all medicine details
    const medicineIds = input.items.map((i) => i.medicineId);
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds }, deletedAt: null },
    });

    if (medicines.length !== medicineIds.length) {
      const foundIds = new Set(medicines.map((m) => m.id));
      const missing = medicineIds.find((id) => !foundIds.has(id));
      throw new MedicineNotFoundError(missing ?? 'Medicine');
    }

    // Load patient allergies
    const allergies = await this.prisma.patientAllergy.findMany({
      where: { patientId: visit.patientId },
      select: { allergen: true },
    });
    const allergenSet = new Set(allergies.map((a) => a.allergen.toLowerCase()));

    // Check allergy warnings for each medicine
    const allergyWarningMap = new Map<string, boolean>();
    for (const med of medicines) {
      const hasWarning = allergenSet.has(med.activeIngredient.toLowerCase());
      allergyWarningMap.set(med.id, hasWarning);
    }

    // Build items with warnings
    const itemsData = input.items.map((item, index) => ({
      medicineId: item.medicineId,
      dosage: item.dosage,
      frequency: item.frequency,
      durationDays: item.durationDays,
      instruction: item.instruction ?? null,
      allergyWarning: allergyWarningMap.get(item.medicineId) ?? false,
      sortOrder: index,
    }));

    const prescription = await this.prescriptionRepository.create({
      visitId: input.visitId,
      note: input.note ?? null,
      createdBy: input.actorId,
      items: itemsData,
    });

    await this.auditLog.write({
      userId: input.actorId,
      action: 'CREATE_PRESCRIPTION',
      module: 'VISIT',
      targetId: prescription.id,
      detail: { visitId: input.visitId, itemCount: input.items.length },
    });

    const withDetails = await this.prescriptionRepository.findWithDetailsById(prescription.id);

    return {
      ...toPrescriptionResponse(prescription),
      patientName: withDetails?.patientName ?? '',
      patientCode: withDetails?.patientCode ?? '',
      patientDateOfBirth: withDetails?.patientDateOfBirth ?? new Date(),
      doctorName: withDetails?.doctorName ?? '',
      appointmentTime: withDetails?.appointmentTime ?? new Date(),
    };
  }
}
