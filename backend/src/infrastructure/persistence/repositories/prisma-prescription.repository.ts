import { Injectable } from '@nestjs/common';
import { Prescription, PrescriptionItemData } from '../../../domain/entities/prescription.entity';
import {
  CreatePrescriptionData,
  PrescriptionRepository,
  PrescriptionWithDetails,
  UpdatePrescriptionData,
} from '../../../domain/repositories/prescription.repository';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../prisma/prisma.service';

const prescriptionItemsInclude = {
  items: {
    include: { medicine: true },
    orderBy: { sortOrder: 'asc' as const },
  },
} as const;

const prescriptionWithVisitInclude = {
  ...prescriptionItemsInclude,
  visit: {
    include: {
      appointment: { include: { service: true } },
      patient: true,
      doctor: true,
    },
  },
} as const;

@Injectable()
export class PrismaPrescriptionRepository implements PrescriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByVisitId(visitId: string): Promise<Prescription | null> {
    const row = await this.prisma.prescription.findFirst({
      where: { visitId },
      include: prescriptionItemsInclude,
    });
    if (!row) return null;
    return this.toDomain(row);
  }

  async findWithDetailsById(id: string): Promise<PrescriptionWithDetails | null> {
    const row = await this.prisma.prescription.findFirst({
      where: { id },
      include: prescriptionWithVisitInclude,
    });
    if (!row) return null;

    const base = this.toDomain(row);
    return {
      ...base,
      patientName: row.visit.patient.fullName,
      patientCode: row.visit.patient.patientCode,
      patientDateOfBirth: row.visit.patient.dateOfBirth,
      doctorName: DoctorDisplayName.format(row.visit.doctor.fullName),
      appointmentTime: row.visit.appointment.appointmentTime,
    };
  }

  async create(data: CreatePrescriptionData): Promise<Prescription> {
    const row = await this.prisma.$transaction(async (tx) => {
      return tx.prescription.create({
        data: {
          visitId: data.visitId,
          note: data.note ?? null,
          createdBy: data.createdBy,
          items: {
            create: data.items.map((item) => ({
              medicineId: item.medicineId,
              dosage: item.dosage,
              frequency: item.frequency,
              durationDays: item.durationDays,
              instruction: item.instruction ?? null,
              allergyWarning: item.allergyWarning,
              sortOrder: item.sortOrder,
            })),
          },
        },
        include: prescriptionItemsInclude,
      });
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdatePrescriptionData): Promise<Prescription> {
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.prescriptionItem.deleteMany({ where: { prescriptionId: id } });
      return tx.prescription.update({
        where: { id },
        data: {
          note: data.note ?? null,
          items: {
            create: data.items.map((item, index) => ({
              medicineId: item.medicineId,
              dosage: item.dosage,
              frequency: item.frequency,
              durationDays: item.durationDays,
              instruction: item.instruction ?? null,
              allergyWarning: item.allergyWarning,
              sortOrder: index,
            })),
          },
        },
        include: prescriptionItemsInclude,
      });
    });
    return this.toDomain(row);
  }

  private toDomain(row: any): Prescription {
    const items: PrescriptionItemData[] = (row.items ?? []).map((item: any) => ({
      id: item.id,
      prescriptionId: item.prescriptionId,
      medicineId: item.medicineId,
      medicineName: item.medicine.name,
      activeIngredient: item.medicine.activeIngredient,
      dosage: item.dosage,
      frequency: item.frequency,
      durationDays: item.durationDays,
      instruction: item.instruction,
      allergyWarning: item.allergyWarning,
      sortOrder: item.sortOrder,
    }));

    return new Prescription(
      row.id,
      row.visitId,
      row.note,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      items,
    );
  }
}
