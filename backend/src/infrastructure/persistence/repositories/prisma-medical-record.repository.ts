import { Injectable } from '@nestjs/common';
import {
  MedicalRecord as PrismaMedicalRecord,
  Prisma,
  SeverityLevel,
} from '@prisma/client';
import { MedicalRecord } from '../../../domain/entities/medical-record.entity';
import { Gender } from '../../../domain/enums/gender.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import {
  MedicalRecordAllergy,
  MedicalRecordDetail,
  MedicalRecordListQuery,
  MedicalRecordListResult,
  MedicalRecordRepository,
  MedicalRecordUpdateData,
  ReplaceMedicalRecordAllergiesData,
} from '../../../domain/repositories/medical-record.repository';
import { PrismaService } from '../prisma/prisma.service';

const medicalRecordDetailInclude = Prisma.validator<Prisma.PatientInclude>()({
  allergies: true,
  medicalRecord: true,
  visits: {
    orderBy: { createdAt: 'desc' },
    include: {
      doctor: true,
      room: true,
      appointment: { include: { service: true } },
      examinationResult: true,
      clsOrders: { include: { service: true, result: { include: { attachments: true } } } },
      prescription: { include: { items: { include: { medicine: true } } } },
    },
  },
});

type MedicalRecordDetailRow = Prisma.PatientGetPayload<{ include: typeof medicalRecordDetailInclude }>;

@Injectable()
export class PrismaMedicalRecordRepository implements MedicalRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(query: MedicalRecordListQuery): Promise<MedicalRecordListResult> {
    const where = this.buildPatientAccessWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.patient.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { updatedAt: 'desc' },
        include: {
          medicalRecord: true,
          _count: { select: { visits: true } },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        patientId: row.id,
        patientCode: row.patientCode,
        fullName: row.fullName,
        email: row.email,
        phone: row.phone,
        totalVisits: row._count.visits,
        updatedAt: row.medicalRecord?.updatedAt ?? null,
      })),
      total,
    };
  }

  async findDetail(patientId: string): Promise<MedicalRecordDetail | null> {
    const row = await this.prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      include: medicalRecordDetailInclude,
    });

    return row ? this.toDetail(row) : null;
  }

  async findByPatientId(patientId: string): Promise<MedicalRecord | null> {
    const row = await this.prisma.medicalRecord.findUnique({ where: { patientId } });
    return row ? this.toDomain(row) : null;
  }

  async hasDoctorVisit(patientId: string, doctorId: string, activeOnly = false): Promise<boolean> {
    const row = await this.prisma.visit.findFirst({
      where: {
        patientId,
        doctorId,
        ...(activeOnly ? { status: { not: 'COMPLETED' } } : {}),
      },
      select: { id: true },
    });

    return Boolean(row);
  }

  async upsertByPatientId(data: MedicalRecordUpdateData): Promise<MedicalRecord> {
    const row = await this.prisma.medicalRecord.upsert({
      where: { patientId: data.patientId },
      create: {
        patientId: data.patientId,
        medicalHistory: data.medicalHistory ?? null,
        clinicalNote: data.clinicalNote ?? null,
        diagnosisSummary: data.diagnosisSummary ?? null,
        treatmentSummary: data.treatmentSummary ?? null,
        followUpNote: data.followUpNote ?? null,
        createdBy: data.updatedBy,
        updatedBy: data.updatedBy,
      },
      update: {
        medicalHistory: data.medicalHistory,
        clinicalNote: data.clinicalNote,
        diagnosisSummary: data.diagnosisSummary,
        treatmentSummary: data.treatmentSummary,
        followUpNote: data.followUpNote,
        updatedBy: data.updatedBy,
      },
    });

    return this.toDomain(row);
  }

  async replaceAllergies(data: ReplaceMedicalRecordAllergiesData): Promise<MedicalRecordAllergy[]> {
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.patientAllergy.deleteMany({ where: { patientId: data.patientId } });

      if (!data.allergies.length) return [];

      await tx.patientAllergy.createMany({
        data: data.allergies.map((allergy) => ({
          patientId: data.patientId,
          allergen: allergy.allergen,
          severity: allergy.severity as SeverityLevel,
          description: allergy.description ?? null,
          createdBy: data.createdBy,
        })),
      });

      return tx.patientAllergy.findMany({
        where: { patientId: data.patientId },
        orderBy: { createdAt: 'asc' },
      });
    });

    return rows.map((row) => ({
      id: row.id,
      allergen: row.allergen,
      severity: row.severity,
      description: row.description,
    }));
  }

  private buildPatientAccessWhere(query: MedicalRecordListQuery): Prisma.PatientWhereInput {
    const search = query.search?.trim();
    const searchWhere: Prisma.PatientWhereInput = search
      ? {
          OR: [
            { patientCode: { contains: search } },
            { fullName: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
            { visits: { some: { id: search } } },
          ],
        }
      : {};

    let accessWhere: Prisma.PatientWhereInput = {};

    if (query.actorRole === 'DOCTOR') {
      accessWhere = { visits: { some: { doctorId: query.actorId } } };
    }

    if (query.actorRole === 'PATIENT') {
      accessWhere = { userId: query.actorId };
    }

    return { deletedAt: null, ...searchWhere, ...accessWhere };
  }

  private toDetail(row: MedicalRecordDetailRow): MedicalRecordDetail {
    return {
      patient: {
        id: row.id,
        patientCode: row.patientCode,
        fullName: row.fullName,
        email: row.email,
        dateOfBirth: row.dateOfBirth,
        gender: row.gender as Gender,
        phone: row.phone,
        idCard: row.idCard ?? '',
        address: row.address,
        note: row.note,
        notificationConsent: row.notificationConsent,
      },
      record: row.medicalRecord ? this.toDomain(row.medicalRecord) : null,
      allergies: row.allergies.map((allergy) => ({
        id: allergy.id,
        allergen: allergy.allergen,
        severity: allergy.severity,
        description: allergy.description,
      })),
      visits: row.visits.map((visit) => ({
        id: visit.id,
        appointmentId: visit.appointmentId,
        doctorId: visit.doctorId,
        doctorName: DoctorDisplayName.format(visit.doctor.fullName),
        roomName: visit.room.name,
        serviceName: visit.appointment.service?.name ?? '',
        status: visit.status,
        createdAt: visit.createdAt,
        completedAt: visit.completedAt,
        diagnosis: visit.examinationResult?.diagnosis ?? null,
        clinicalNote: visit.examinationResult?.clinicalNote ?? null,
        treatmentResult: visit.examinationResult?.treatmentResult ?? null,
        followUpDate: visit.examinationResult?.followUpDate ?? null,
        paraclinicalResults: visit.clsOrders.map((order) => ({
          id: order.id,
          serviceName: order.service.name,
          status: order.status,
          summary: order.result?.summary ?? null,
          resultData: order.result?.resultData ?? null,
          attachments:
            order.result?.attachments.map((attachment) => ({
              id: attachment.id,
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
              fileType: attachment.fileType,
              fileSizeKb: attachment.fileSizeKb,
              uploadedAt: attachment.uploadedAt,
            })) ?? [],
        })),
        prescriptions:
          visit.prescription?.items.map((item) => ({
            id: item.id,
            medicineName: item.medicine.name,
            dosage: item.dosage,
            frequency: item.frequency,
            durationDays: item.durationDays,
            instruction: item.instruction,
          })) ?? [],
      })),
    };
  }

  private toDomain(row: PrismaMedicalRecord): MedicalRecord {
    return new MedicalRecord(
      row.id,
      row.patientId,
      row.medicalHistory,
      row.clinicalNote,
      row.diagnosisSummary,
      row.treatmentSummary,
      row.followUpNote,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      row.updatedBy,
    );
  }
}
