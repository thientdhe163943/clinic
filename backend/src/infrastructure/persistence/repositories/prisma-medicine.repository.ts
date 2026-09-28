import { Injectable } from '@nestjs/common';
import { Medicine as PrismaMedicine, Prisma } from '@prisma/client';
import { Medicine } from '../../../domain/entities/medicine.entity';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';
import {
  CreateMedicineData,
  MedicineListFilter,
  MedicineRepository,
  UpdateMedicineData,
} from '../../../domain/repositories/medicine.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaMedicineRepository implements MedicineRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Medicine | null> {
    const row = await this.prisma.medicine.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string): Promise<Medicine | null> {
    const row = await this.prisma.medicine.findFirst({ where: { name, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findMany(filter: MedicineListFilter): Promise<{ items: Medicine[]; total: number }> {
    const search = filter.search?.trim();

    // Mirrors the original inline controller's OR(name, activeIngredient)
    // search, kept for the doctor-prescribing dropdown's behavior.
    const where: Prisma.MedicineWhereInput = {
      deletedAt: null,
      ...(filter.onlyActive ? { isActive: true } : {}),
      ...(search
        ? { OR: [{ name: { contains: search } }, { activeIngredient: { contains: search } }] }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.medicine.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.medicine.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDomain(row)), total };
  }

  async create(data: CreateMedicineData): Promise<Medicine> {
    const row = await this.prisma.medicine.create({
      data: {
        name: data.name,
        activeIngredient: data.activeIngredient,
        dosageForm: data.dosageForm,
        unit: data.unit,
        price: data.price ?? null,
        contraindications: data.contraindications ?? null,
        description: data.description ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateMedicineData): Promise<Medicine> {
    const row = await this.prisma.medicine.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.activeIngredient !== undefined && { activeIngredient: data.activeIngredient }),
        ...(data.dosageForm !== undefined && { dosageForm: data.dosageForm }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.contraindications !== undefined && { contraindications: data.contraindications }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.medicine.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: deletedBy } });
  }

  async isInUse(id: string): Promise<boolean> {
    const count = await this.prisma.prescriptionItem.count({ where: { medicineId: id } });
    return count > 0;
  }

  private toDomain(row: PrismaMedicine): Medicine {
    return new Medicine(
      row.id,
      row.name,
      row.activeIngredient,
      row.dosageForm,
      row.unit as MeasurementUnit,
      row.price ? Number(row.price) : null,
      row.contraindications,
      row.description,
      row.isActive,
      row.createdAt,
      row.updatedAt,
      row.deletedAt,
    );
  }
}
