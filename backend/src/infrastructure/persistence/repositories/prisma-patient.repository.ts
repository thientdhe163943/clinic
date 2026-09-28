import { Injectable } from '@nestjs/common';
import { Patient as PrismaPatient, Prisma } from '@prisma/client';
import { Patient } from '../../../domain/entities/patient.entity';
import { Gender } from '../../../domain/enums/gender.enum';
import {
  CreatePatientData,
  PatientListQuery,
  PatientListResult,
  PatientRepository,
  PatientUpdateData,
} from '../../../domain/repositories/patient.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaPatientRepository implements PatientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByPhone(phone: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({ where: { phone, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({ where: { email, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByIdCard(idCard: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({ where: { idCard, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Patient | null> {
    const row = await this.prisma.patient.findFirst({ where: { userId, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findMany(query: PatientListQuery): Promise<PatientListResult> {
    const search = query.search?.trim();
    const where: Prisma.PatientWhereInput = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { patientCode: { contains: search } },
              { fullName: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return { data: rows.map((row) => this.toDomain(row)), total };
  }

  async create(data: CreatePatientData): Promise<Patient> {
    const row = await this.prisma.patient.create({
      data: {
        patientCode: data.patientCode,
        fullName: data.fullName,
        email: data.email ?? null,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phone: data.phone,
        idCard: data.idCard ?? null,
        address: data.address ?? null,
        note: data.note ?? null,
        notificationConsent: data.notificationConsent ?? true,
        userId: data.userId ?? null,
        createdBy: data.createdBy,
      },
    });

    return this.toDomain(row);
  }

  async update(id: string, data: PatientUpdateData): Promise<Patient> {
    const row = await this.prisma.patient.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        phone: data.phone,
        idCard: data.idCard,
        address: data.address,
        note: data.note,
        notificationConsent: data.notificationConsent,
        updatedBy: data.updatedBy,
      },
    });

    return this.toDomain(row);
  }

  async linkUser(id: string, userId: string): Promise<Patient> {
    const row = await this.prisma.patient.update({
      where: { id },
      data: { userId },
    });

    return this.toDomain(row);
  }

  private toDomain(row: PrismaPatient): Patient {
    return new Patient(
      row.id,
      row.patientCode,
      row.fullName,
      row.email,
      row.dateOfBirth,
      row.gender as Gender,
      row.phone,
      row.idCard ?? '',
      row.address,
      row.note,
      row.notificationConsent,
      row.userId,
      row.createdAt,
      row.updatedAt,
    );
  }
}
