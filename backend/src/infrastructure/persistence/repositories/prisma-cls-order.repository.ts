import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AttachmentBeforeResultSavedError } from '../../../application/errors/application-error';
import { ClsOrder } from '../../../domain/entities/cls-order.entity';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import type {
  ClsOrderListItem,
  ClsOrderRepository,
  CreateClsOrderData,
  LabResultRow,
  ListClsOrdersFilter,
  UpdateClsOrderData,
} from '../../../domain/repositories/cls-order.repository';
import { PrismaService } from '../prisma/prisma.service';

const clsOrderWithDetailsInclude = {
  visit: {
    include: {
      appointment: true,
      patient: true,
      doctor: true,
    },
  },
  clsRoom: true,
  service: true,
  result: {
    include: { attachments: true },
  },
  // CLS payment-before-queue change (2026-08-21): lets ListAllClsOrdersUseCase
  // exclude an order from the lab tech's queue view until its fee is paid,
  // without touching CreateClsOrderUseCase (the doctor's own ordering flow
  // stays exactly as-is — see toListItem()'s isPaid computation below).
  invoiceItems: true,
} as const;

@Injectable()
export class PrismaClsOrderRepository implements ClsOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ClsOrder | null> {
    const row = await this.prisma.clsOrder.findFirst({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findWithDetailById(id: string): Promise<ClsOrderListItem | null> {
    const row = await this.prisma.clsOrder.findFirst({
      where: { id },
      include: clsOrderWithDetailsInclude,
    });
    if (!row) return null;
    return this.toListItem(row);
  }

  async findByVisitId(visitId: string): Promise<ClsOrderListItem[]> {
    const rows = await this.prisma.clsOrder.findMany({
      where: { visitId },
      include: clsOrderWithDetailsInclude,
    });
    return rows.map((row) => this.toListItem(row));
  }

  async countInProgressByRoom(clsRoomId: string): Promise<number> {
    const { start, end } = this.todayVnRange();
    return this.prisma.clsOrder.count({
      where: { clsRoomId, status: ClsOrderStatus.IN_PROGRESS, createdAt: { gte: start, lt: end } },
    });
  }

  async countInProgressByRoomExcludingVisit(clsRoomId: string, excludeVisitId: string): Promise<number> {
    const { start, end } = this.todayVnRange();
    return this.prisma.clsOrder.count({
      where: {
        clsRoomId,
        status: ClsOrderStatus.IN_PROGRESS,
        visitId: { not: excludeVisitId },
        createdAt: { gte: start, lt: end },
      },
    });
  }

  private todayVnRange() {
    const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
    const todayVn = new Date(Date.now() + VN_OFFSET_MS);
    const start = new Date(Date.UTC(todayVn.getUTCFullYear(), todayVn.getUTCMonth(), todayVn.getUTCDate()) - VN_OFFSET_MS);
    return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
  }

  async create(data: CreateClsOrderData): Promise<ClsOrder> {
    const row = await this.prisma.clsOrder.create({
      data: {
        visitId: data.visitId,
        clsRoomId: data.clsRoomId,
        serviceId: data.serviceId,
        note: data.note ?? null,
        createdBy: data.createdBy,
        status: ClsOrderStatus.PENDING,
      },
    });
    return this.toDomain(row);
  }

  async findAll(filter: ListClsOrdersFilter): Promise<ClsOrderListItem[]> {
    const dateFilter = filter.date
      ? (() => {
          const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
          const [y, m, d] = filter.date!.split('-').map(Number);
          const start = new Date(Date.UTC(y, m - 1, d) - VN_OFFSET_MS);
          return {
            gte: start,
            lt:  new Date(start.getTime() + 24 * 60 * 60 * 1000),
          };
        })()
      : undefined;

    const rows = await this.prisma.clsOrder.findMany({
      where: {
        ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
        ...(dateFilter ? { createdAt: dateFilter } : {}),
        ...(filter.clsRoomId ? { clsRoomId: filter.clsRoomId } : {}),
      },
      include: clsOrderWithDetailsInclude,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toListItem(row));
  }

  async update(id: string, data: UpdateClsOrderData): Promise<ClsOrder> {
    const row = await this.prisma.clsOrder.update({ where: { id }, data });
    return this.toDomain(row);
  }

  async updateStatus(id: string, status: ClsOrderStatus, calledAt?: Date): Promise<ClsOrder> {
    const row = await this.prisma.clsOrder.update({
      where: { id },
      data: {
        status,
        ...(calledAt !== undefined ? { calledAt } : {}),
      },
    });
    return this.toDomain(row);
  }

  async enterResult(
    id: string,
    summary: string,
    actorId: string,
    rows: LabResultRow[] | undefined,
    findings: string | undefined,
    finalize: boolean,
  ): Promise<ClsOrder> {
    // resultData holds { rows } for LAB-category CLS rooms, or { findings }
    // for XRAY/ULTRASOUND (the "KẾT QUẢ" description separate from the "KL"
    // conclusion stored in `summary`) — never both, since a CLS room only
    // ever belongs to one category.
    const resultData = (
      rows && rows.length > 0 ? { rows } :
      findings ? { findings } :
      {}
    ) as Prisma.InputJsonValue;
    // finalize=false: persist the draft only, order stays IN_PROGRESS and
    // stays editable. finalize=true: same persist, plus lock the order by
    // moving it to COMPLETED (see EnterClsResultUseCase's guard against
    // re-entering a COMPLETED order).
    const [updated] = await this.prisma.$transaction([
      this.prisma.clsOrder.update({
        where: { id },
        data: finalize ? { status: ClsOrderStatus.COMPLETED } : {},
      }),
      this.prisma.clsResult.upsert({
        where: { clsOrderId: id },
        create: {
          clsOrderId: id,
          resultData,
          summary,
          createdBy: actorId,
          updatedAt: new Date(),
        },
        update: {
          resultData,
          summary,
          updatedBy: actorId,
          updatedAt: new Date(),
        },
      }),
    ]);
    return this.toDomain(updated);
  }

  private toDomain(row: {
    id: string;
    visitId: string;
    clsRoomId: string;
    serviceId: string;
    note: string | null;
    status: string;
    calledAt: Date | null;
    createdAt: Date;
    createdBy: string;
  }): ClsOrder {
    return new ClsOrder(
      row.id,
      row.visitId,
      row.clsRoomId,
      row.serviceId,
      row.note,
      row.status as ClsOrderStatus,
      row.calledAt,
      row.createdAt,
      row.createdBy,
    );
  }

  async addAttachment(clsOrderId: string, data: {
    fileName: string;
    fileUrl: string;
    fileType: 'PDF' | 'JPG' | 'PNG' | 'DICOM';
    fileSizeKb?: number;
    uploadedBy: string;
  }): Promise<void> {
    const result = await this.prisma.clsResult.findUnique({ where: { clsOrderId } });
    if (!result) throw new AttachmentBeforeResultSavedError();
    await this.prisma.clsAttachment.create({
      data: {
        clsResultId: result.id,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType as any,
        fileSizeKb: data.fileSizeKb,
        uploadedBy: data.uploadedBy,
      },
    });
  }

  private toListItem(row: any): ClsOrderListItem {
    return {
      order: this.toDomain(row),
      serviceName: row.service.name,
      servicePrice: Number(row.service.price),
      clsRoomName: row.clsRoom.name,
      clsRoomCategory: row.clsRoom.clsCategory ?? null,
      patientName: row.visit.patient.fullName,
      patientCode: row.visit.patient.patientCode,
      dateOfBirth: row.visit.patient.dateOfBirth ?? null,
      gender: row.visit.patient.gender ?? '',
      doctorName: DoctorDisplayName.format(row.visit.doctor.fullName),
      appointmentTime: row.visit.appointment.appointmentTime,
      resultSummary: row.result?.summary ?? null,
      resultAttachments: (row.result?.attachments ?? []).map((a: any) => ({
        fileName: a.fileName,
        fileUrl: a.fileUrl,
      })),
      resultRows: this.extractResultRows(row.result?.resultData),
      resultFindings: this.extractFindings(row.result?.resultData),
      resultEnteredBy: row.result?.updatedBy ?? row.result?.createdBy ?? null,
      // CLS payment-before-queue change (2026-08-21): a CLS fee is always
      // billed when the order is created (CreateClsOrderUseCase), so
      // "no invoiceItems row at all" shouldn't normally happen — treated as
      // unpaid (not the fail-open direction) if it ever does.
      isPaid: (row.invoiceItems ?? []).some((item: { paidAt: Date | null }) => item.paidAt !== null),
    };
  }

  private extractResultRows(resultData: unknown): LabResultRow[] | null {
    if (!resultData || typeof resultData !== 'object') return null;
    const rows = (resultData as { rows?: unknown }).rows;
    return Array.isArray(rows) && rows.length > 0 ? (rows as LabResultRow[]) : null;
  }

  private extractFindings(resultData: unknown): string | null {
    if (!resultData || typeof resultData !== 'object') return null;
    const findings = (resultData as { findings?: unknown }).findings;
    return typeof findings === 'string' && findings.length > 0 ? findings : null;
  }
}
