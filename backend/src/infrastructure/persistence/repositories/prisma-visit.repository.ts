import { Injectable } from '@nestjs/common';
import { ExaminationResult } from '../../../domain/entities/examination-result.entity';
import { Visit } from '../../../domain/entities/visit.entity';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import {
  CreateExaminationResultData,
  ExaminationResultWithVisit,
  RecheckCandidate,
  UpdateExaminationResultData,
  VitalSignsData,
  VitalSignsRecord,
  VisitListFilter,
  VisitListItem,
  VisitListItemWithRoom,
  VisitRepository,
} from '../../../domain/repositories/visit.repository';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaVisitRepository implements VisitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Visit | null> {
    const row = await this.prisma.visit.findFirst({ where: { id } });
    return row ? this.toVisitDomain(row) : null;
  }

  async findByAppointmentId(appointmentId: string): Promise<Visit | null> {
    const row = await this.prisma.visit.findUnique({ where: { appointmentId } });
    return row ? this.toVisitDomain(row) : null;
  }

  async countNoShowsSince(patientId: string, since: Date): Promise<number> {
    return this.prisma.visit.count({
      where: { patientId, status: VisitStatus.NO_SHOW, createdAt: { gte: since } },
    });
  }

  async findByIdWithDetails(id: string): Promise<VisitListItemWithRoom | null> {
    const row = await this.prisma.visit.findFirst({
      where: { id },
      include: {
        appointment: { include: { service: true } },
        patient: true,
        room: true,
        doctor: true,
      },
    });
    if (!row) return null;
    return {
      visit: this.toVisitDomain(row),
      patientName: row.patient.fullName,
      patientCode: row.patient.patientCode,
      patientPhone: row.patient.phone,
      doctorName: DoctorDisplayName.format(row.doctor.fullName),
      serviceName: row.appointment.service?.name ?? '',
      appointmentTime: row.appointment.appointmentTime,
      checkedInAt: row.appointment.checkedInAt,
      note: row.appointment.note,
      roomName: row.room.name,
    };
  }

  async findListWithDetails(filter: VisitListFilter): Promise<VisitListItem[]> {
    const dateFilter = filter.date
      ? (() => {
          const [year, month, day] = filter.date!.split('-').map(Number);
          // Shift by -7h so UTC boundaries align with Vietnam midnight (UTC+7)
          const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
          const start = new Date(Date.UTC(year, month - 1, day) - VN_OFFSET_MS);
          const end = new Date(Date.UTC(year, month - 1, day + 1) - VN_OFFSET_MS);
          return { gte: start, lt: end };
        })()
      : undefined;

    const PRIORITY_RANK: Record<string, number> = {
      EMERGENCY: 0,
      ELDERLY: 1,
      PREGNANT: 1,
      CHILD: 1,
      NORMAL: 2,
    };
    const STATUS_RANK: Record<string, number> = {
      WAITING: 0,
      CALLED: 1,
      IN_PROGRESS: 1,
      AWAITING_RESULTS: 1,
      COMPLETED: 2,
      NO_SHOW: 3,
    };

    const rows = await this.prisma.visit.findMany({
      where: {
        ...(filter.doctorId ? { doctorId: filter.doctorId } : {}),
        ...(filter.roomId ? { roomId: filter.roomId } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(filter.status ? { status: filter.status } : {}),
      },
      include: {
        appointment: { include: { service: true } },
        patient: true,
        doctor: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    rows.sort((a, b) => {
      const pDiff = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
      if (pDiff !== 0) return pDiff;
      const sDiff = (STATUS_RANK[a.status] ?? 1) - (STATUS_RANK[b.status] ?? 1);
      if (sDiff !== 0) return sDiff;
      return (a.queueNumber ?? '').localeCompare(b.queueNumber ?? '');
    });

    return rows.map((row) => ({
      visit: this.toVisitDomain(row),
      patientName: row.patient.fullName,
      patientCode: row.patient.patientCode,
      patientPhone: row.patient.phone,
      doctorName: DoctorDisplayName.format(row.doctor.fullName),
      serviceName: row.appointment.service?.name ?? '',
      appointmentTime: row.appointment.appointmentTime,
      checkedInAt: row.appointment.checkedInAt,
      note: row.appointment.note,
    }));
  }

  async countInProgressByRoom(roomId: string): Promise<number> {
    return this.prisma.visit.count({
      where: {
        roomId,
        status: VisitStatus.IN_PROGRESS,
      },
    });
  }

  async callPatient(id: string, calledAt: Date, calledCount: number): Promise<Visit> {
    const row = await this.prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.CALLED,
        calledAt,
        calledCount,
      },
    });
    return this.toVisitDomain(row);
  }

  async startVisit(id: string, startedAt: Date): Promise<Visit> {
    const row = await this.prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.IN_PROGRESS,
        startedAt,
      },
    });
    return this.toVisitDomain(row);
  }

  async holdForResults(id: string): Promise<Visit> {
    const row = await this.prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.AWAITING_RESULTS,
      },
    });
    return this.toVisitDomain(row);
  }

  async markNoShow(id: string): Promise<Visit> {
    const row = await this.prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.NO_SHOW,
      },
    });
    return this.toVisitDomain(row);
  }

  async completeVisit(id: string, completedAt: Date): Promise<Visit> {
    const row = await this.prisma.visit.update({
      where: { id },
      data: {
        status: VisitStatus.COMPLETED,
        completedAt,
      },
    });
    return this.toVisitDomain(row);
  }

  async cancelStaleBefore(cutoff: Date): Promise<number> {
    const result = await this.prisma.visit.updateMany({
      where: {
        status: {
          in: [VisitStatus.WAITING, VisitStatus.CALLED, VisitStatus.IN_PROGRESS, VisitStatus.AWAITING_RESULTS],
        },
        appointment: { appointmentTime: { lt: cutoff } },
      },
      data: { status: VisitStatus.CANCELLED },
    });
    return result.count;
  }

  async hasIncompleteClsOrders(visitId: string): Promise<boolean> {
    const count = await this.prisma.clsOrder.count({
      where: {
        visitId,
        status: {
          notIn: [ClsOrderStatus.COMPLETED, ClsOrderStatus.CANCELLED],
        },
      },
    });
    return count > 0;
  }

  async createExaminationResult(data: CreateExaminationResultData): Promise<ExaminationResult> {
    const row = await this.prisma.examinationResult.create({
      data: {
        visitId: data.visitId,
        diagnosis: data.diagnosis,
        clinicalNote: data.clinicalNote ?? null,
        treatmentResult: data.treatmentResult ?? null,
        followUpDate: data.followUpDate ?? null,
        accessCode: data.accessCode,
        accessCodeExpiresAt: data.accessCodeExpiresAt ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toExaminationResultDomain(row);
  }

  async upsertVitalSigns(visitId: string, data: VitalSignsData): Promise<VitalSignsRecord> {
    const row = await this.prisma.vitalSigns.upsert({
      where: { visitId },
      create: {
        id: require('crypto').randomUUID(),
        visitId,
        systolicBp: data.systolicBp ?? null,
        diastolicBp: data.diastolicBp ?? null,
        heartRate: data.heartRate ?? null,
        temperature: data.temperature ?? null,
        spo2: data.spo2 ?? null,
        weight: data.weight ?? null,
        height: data.height ?? null,
        recordedBy: data.recordedBy,
        recordedAt: new Date(),
      },
      update: {
        systolicBp: data.systolicBp ?? null,
        diastolicBp: data.diastolicBp ?? null,
        heartRate: data.heartRate ?? null,
        temperature: data.temperature ?? null,
        spo2: data.spo2 ?? null,
        weight: data.weight ?? null,
        height: data.height ?? null,
        recordedBy: data.recordedBy,
        recordedAt: new Date(),
      },
    });
    return this.toVitalSigns(row);
  }

  async getVitalSigns(visitId: string): Promise<VitalSignsRecord | null> {
    const row = await this.prisma.vitalSigns.findUnique({ where: { visitId } });
    return row ? this.toVitalSigns(row) : null;
  }

  private toVitalSigns(row: any): VitalSignsRecord {
    return {
      id: row.id,
      visitId: row.visitId,
      systolicBp: row.systolicBp ?? null,
      diastolicBp: row.diastolicBp ?? null,
      heartRate: row.heartRate ?? null,
      temperature: row.temperature ? Number(row.temperature) : null,
      spo2: row.spo2 ?? null,
      weight: row.weight ? Number(row.weight) : null,
      height: row.height ? Number(row.height) : null,
      recordedBy: row.recordedBy,
      recordedAt: row.recordedAt,
    };
  }

  async updateExaminationResult(visitId: string, data: UpdateExaminationResultData): Promise<void> {
    await this.prisma.examinationResult.update({
      where: { visitId },
      data: {
        ...(data.diagnosis !== undefined ? { diagnosis: data.diagnosis } : {}),
        ...(data.clinicalNote !== undefined ? { clinicalNote: data.clinicalNote } : {}),
        ...(data.treatmentResult !== undefined ? { treatmentResult: data.treatmentResult } : {}),
        ...(data.followUpDate !== undefined ? { followUpDate: data.followUpDate } : {}),
        updatedBy: data.updatedBy,
        updatedAt: new Date(),
      },
    });
  }

  async findResultWithDetails(visitId: string): Promise<ExaminationResultWithVisit | null> {
    const row = await this.prisma.examinationResult.findFirst({
      where: { visitId },
      include: {
        visit: {
          include: {
            appointment: { include: { service: true } },
            patient: true,
            doctor: true,
            clsOrders: { include: { result: true, service: true, clsRoom: true } },
          },
        },
      },
    });
    if (!row) return null;
    return this.toExaminationResultWithVisit(row);
  }

  async findResultByAccessCode(accessCode: string): Promise<ExaminationResultWithVisit | null> {
    const row = await this.prisma.examinationResult.findFirst({
      where: { accessCode },
      include: {
        visit: {
          include: {
            appointment: { include: { service: true } },
            patient: true,
            doctor: true,
            clsOrders: { include: { result: true, service: true, clsRoom: true } },
          },
        },
      },
    });
    if (!row) return null;
    return this.toExaminationResultWithVisit(row);
  }

  async findRecheckCandidates(targetDates: Date[]): Promise<RecheckCandidate[]> {
    const rows = await this.prisma.examinationResult.findMany({
      where: { followUpDate: { in: targetDates } },
      select: { visitId: true, followUpDate: true, visit: { select: { patientId: true } } },
    });
    return rows
      .filter((row) => row.followUpDate !== null)
      .map((row) => ({ visitId: row.visitId, patientId: row.visit.patientId, followUpDate: row.followUpDate as Date }));
  }

  private toVisitDomain(row: {
    id: string;
    appointmentId: string;
    patientId: string;
    doctorId: string;
    roomId: string;
    queueNumber: string | null;
    priority: string;
    status: string;
    calledAt: Date | null;
    calledCount: number;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }): Visit {
    return new Visit(
      row.id,
      row.appointmentId,
      row.patientId,
      row.doctorId,
      row.roomId,
      row.queueNumber,
      row.priority as VisitPriority,
      row.status as VisitStatus,
      row.calledAt,
      row.calledCount,
      row.startedAt,
      row.completedAt,
      row.createdAt,
    );
  }

  private toExaminationResultDomain(row: {
    id: string;
    visitId: string;
    diagnosis: string;
    clinicalNote: string | null;
    treatmentResult: string | null;
    followUpDate: Date | null;
    accessCode: string;
    accessCodeExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string | null;
  }): ExaminationResult {
    return new ExaminationResult(
      row.id,
      row.visitId,
      row.diagnosis,
      row.clinicalNote,
      row.treatmentResult,
      row.followUpDate,
      row.accessCode,
      row.accessCodeExpiresAt,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      row.updatedBy,
    );
  }

  private toExaminationResultWithVisit(row: any): ExaminationResultWithVisit {
    const visit = row.visit;
    return {
      result: this.toExaminationResultDomain(row),
      visit: this.toVisitDomain(visit),
      patientName: visit.patient.fullName,
      patientCode: visit.patient.patientCode,
      patientDateOfBirth: visit.patient.dateOfBirth ?? null,
      patientGender: visit.patient.gender,
      patientAddress: visit.patient.address ?? null,
      doctorName: DoctorDisplayName.format(visit.doctor.fullName),
      serviceName: visit.appointment.service?.name ?? '',
      appointmentTime: visit.appointment.appointmentTime,
      clsSummaries: (visit.clsOrders as any[])
        .filter((o) => o.status === 'COMPLETED')
        .map((order) => ({
          serviceName: order.service?.name ?? '',
          clsRoomCategory: order.clsRoom?.clsCategory ?? null,
          summary: order.result?.summary ?? null,
          resultRows: this.extractClsLabRows(order.result?.resultData),
          resultFindings: this.extractClsFindings(order.result?.resultData),
        })),
    };
  }

  private extractClsLabRows(resultData: unknown): { name: string; result: string; unit?: string; normalRange?: string; note?: string }[] | null {
    if (!resultData || typeof resultData !== 'object') return null;
    const rows = (resultData as { rows?: unknown }).rows;
    return Array.isArray(rows) && rows.length > 0 ? rows as any[] : null;
  }

  private extractClsFindings(resultData: unknown): string | null {
    if (!resultData || typeof resultData !== 'object') return null;
    const findings = (resultData as { findings?: unknown }).findings;
    return typeof findings === 'string' && findings.length > 0 ? findings : null;
  }
}
