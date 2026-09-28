import { Inject, Injectable } from '@nestjs/common';
import { CreatePrescriptionItemDto } from '../../dtos/prescriptions/create-prescription.dto';
import { PrescriptionPrintDto, toPrescriptionResponse } from '../../dtos/prescriptions/prescription-response.dto';
import {
  MedicineNotFoundError,
  PrescriptionNotFoundError,
  VisitNotFoundError,
  VisitNotInProgressError,
} from '../../errors/application-error';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PRESCRIPTION_REPOSITORY, PrescriptionRepository } from '../../../domain/repositories/prescription.repository';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface UpdatePrescriptionInput {
  prescriptionId: string;
  note?: string;
  items: CreatePrescriptionItemDto[];
  actorId: string;
}

@Injectable()
export class UpdatePrescriptionUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PRESCRIPTION_REPOSITORY) private readonly prescriptionRepository: PrescriptionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: UpdatePrescriptionInput): Promise<PrescriptionPrintDto> {
    const existing = await this.prescriptionRepository.findWithDetailsById(input.prescriptionId);
    if (!existing) throw new PrescriptionNotFoundError();

    const visit = await this.visitRepository.findById(existing.visitId);
    if (!visit) throw new VisitNotFoundError();
    if (visit.status !== VisitStatus.IN_PROGRESS) throw new VisitNotInProgressError();

    const medicineIds = input.items.map((i) => i.medicineId);
    const medicines = await this.prisma.medicine.findMany({
      where: { id: { in: medicineIds }, deletedAt: null },
    });

    if (medicines.length !== medicineIds.length) {
      const foundIds = new Set(medicines.map((m) => m.id));
      const missing = medicineIds.find((id) => !foundIds.has(id));
      throw new MedicineNotFoundError(missing ?? 'Medicine');
    }

    const allergies = await this.prisma.patientAllergy.findMany({
      where: { patientId: visit.patientId },
      select: { allergen: true },
    });
    const allergenSet = new Set(allergies.map((a) => a.allergen.toLowerCase()));

    const itemsData = input.items.map((item, index) => ({
      medicineId: item.medicineId,
      dosage: item.dosage,
      frequency: item.frequency,
      durationDays: item.durationDays,
      instruction: item.instruction ?? null,
      allergyWarning: allergenSet.has(
        medicines.find((m) => m.id === item.medicineId)?.activeIngredient?.toLowerCase() ?? '',
      ),
      sortOrder: index,
    }));

    const updated = await this.prescriptionRepository.update(input.prescriptionId, {
      note: input.note ?? null,
      items: itemsData,
    });

    const withDetails = await this.prescriptionRepository.findWithDetailsById(updated.id);

    return {
      ...toPrescriptionResponse(updated),
      patientName: withDetails?.patientName ?? '',
      patientCode: withDetails?.patientCode ?? '',
      patientDateOfBirth: withDetails?.patientDateOfBirth ?? new Date(),
      doctorName: withDetails?.doctorName ?? '',
      appointmentTime: withDetails?.appointmentTime ?? new Date(),
    };
  }
}
