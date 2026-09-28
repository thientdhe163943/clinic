import { Injectable } from '@nestjs/common';
import { Appointment as PrismaAppointment, Prisma } from '@prisma/client';
import { CONFIRMED_STALE_MINUTES } from '../../../domain/constants/appointment-slot.constant';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { Invoice, InvoiceItem } from '../../../domain/entities/invoice.entity';
import { Visit } from '../../../domain/entities/visit.entity';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { InvoiceCode } from '../../../domain/value-objects/invoice-code.vo';
import {
  AppointmentHistoryEntry,
  AppointmentListFilter,
  AppointmentListItem,
  AppointmentRepository,
  CheckInData,
  CheckInResult,
  CreateAppointmentData,
  CreateVisitData,
  CreateVisitForCheckInData,
  UpdateAppointmentData,
} from '../../../domain/repositories/appointment.repository';
import { PrismaService } from '../prisma/prisma.service';

// Same bounded-retry pattern as CreateInvoiceUseCase — invoiceCode has a
// UNIQUE constraint and is randomly generated (see InvoiceCode.generate()).
const INVOICE_CODE_GENERATION_ATTEMPTS = 5;

@Injectable()
export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async countActiveByPatient(patientId: string, from: Date): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        patientId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
        appointmentTime: { gte: from },
      },
    });
  }

  async findConflict(patientId: string, appointmentTime: Date, excludeId?: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findFirst({
      where: {
        patientId,
        appointmentTime,
        status: { notIn: this.nonBlockingStatuses(appointmentTime) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return row ? this.toDomain(row) : null;
  }

  async findDoctorConflict(doctorId: string, appointmentTime: Date, excludeId?: string): Promise<Appointment | null> {
    const row = await this.prisma.appointment.findFirst({
      where: {
        doctorId,
        appointmentTime,
        status: { notIn: this.nonBlockingStatuses(appointmentTime) },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    return row ? this.toDomain(row) : null;
  }

  // Feature 59 business rule (added 2026-07-08): a Confirmed appointment
  // more than CONFIRMED_STALE_MINUTES past its own appointment_time without
  // being checked in no longer blocks that slot. Every conflict query above
  // pins appointmentTime to the exact requested slot, so staleness reduces
  // to comparing "now" against that one fixed value.
  private nonBlockingStatuses(appointmentTime: Date): AppointmentStatus[] {
    const isStaleConfirmed = Date.now() - appointmentTime.getTime() > CONFIRMED_STALE_MINUTES * 60 * 1000;
    return isStaleConfirmed
      ? [AppointmentStatus.CANCELLED, AppointmentStatus.CONFIRMED]
      : [AppointmentStatus.CANCELLED];
  }

  async findByScheduleId(scheduleId: string, statuses: AppointmentStatus[]): Promise<Appointment[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { scheduleId, status: { in: statuses } },
      orderBy: { appointmentTime: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findMany(filter: AppointmentListFilter): Promise<{ items: AppointmentListItem[]; total: number }> {
    const search = filter.search?.trim();

    const where: Prisma.AppointmentWhereInput = {
      ...(filter.doctorId ? { doctorId: filter.doctorId } : {}),
      ...(filter.patientId ? { patientId: filter.patientId } : {}),
      ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
      ...(filter.date
        ? {
            appointmentTime: {
              gte: new Date(
                Date.UTC(filter.date.getUTCFullYear(), filter.date.getUTCMonth(), filter.date.getUTCDate()),
              ),
              lt: new Date(
                Date.UTC(filter.date.getUTCFullYear(), filter.date.getUTCMonth(), filter.date.getUTCDate() + 1),
              ),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { patient: { fullName: { contains: search } } },
              { patient: { patientCode: { contains: search } } },
              { patient: { phone: { contains: search } } },
              { doctor: { fullName: { contains: search } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where,
        include: {
          patient: true,
          doctor: true,
          service: true,
          visit: { select: { id: true } },
          room: { select: { name: true } },
        },
        orderBy: { appointmentTime: filter.sort ?? 'asc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    const items: AppointmentListItem[] = rows.map((row) => ({
      appointment: this.toDomain(row),
      patientName: row.patient.fullName,
      patientCode: row.patient.patientCode,
      doctorName: row.doctor ? DoctorDisplayName.format(row.doctor.fullName) : '',
      serviceName: row.service?.name ?? '',
      visitId: row.visit?.id ?? null,
      roomName: row.room?.name ?? null,
    }));

    return { items, total };
  }

  async create(data: CreateAppointmentData): Promise<Appointment> {
    const row = await this.prisma.appointment.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId ?? null,
        serviceId: data.serviceId ?? null,
        scheduleId: data.scheduleId ?? null,
        appointmentTime: data.appointmentTime,
        status: data.status,
        note: data.note ?? null,
        bookedBy: data.bookedBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateAppointmentData): Promise<Appointment> {
    const row = await this.prisma.appointment.update({
      where: { id },
      data: {
        ...(data.doctorId !== undefined && { doctorId: data.doctorId }),
        ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
        ...(data.scheduleId !== undefined && { scheduleId: data.scheduleId }),
        ...(data.appointmentTime !== undefined && { appointmentTime: data.appointmentTime }),
        ...(data.note !== undefined && { note: data.note }),
      },
    });
    return this.toDomain(row);
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    extra?: {
      cancelReason?: string | null;
      cancelledBy?: string | null;
      cancelledAt?: Date | null;
      checkedInAt?: Date | null;
      roomId?: string | null;
    },
  ): Promise<Appointment> {
    const row = await this.prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(extra?.cancelReason !== undefined && { cancelReason: extra.cancelReason }),
        ...(extra?.cancelledBy !== undefined && { cancelledBy: extra.cancelledBy }),
        ...(extra?.cancelledAt !== undefined && { cancelledAt: extra.cancelledAt }),
        ...(extra?.checkedInAt !== undefined && { checkedInAt: extra.checkedInAt }),
        ...(extra?.roomId !== undefined && { roomId: extra.roomId }),
      },
    });
    return this.toDomain(row);
  }

  async addHistory(entry: AppointmentHistoryEntry): Promise<void> {
    await this.prisma.appointmentHistory.create({
      data: {
        appointmentId: entry.appointmentId,
        oldStatus: entry.oldStatus ?? null,
        newStatus: entry.newStatus,
        oldTime: entry.oldTime ?? null,
        newTime: entry.newTime ?? null,
        oldDoctorId: entry.oldDoctorId ?? null,
        newDoctorId: entry.newDoctorId ?? null,
        reason: entry.reason ?? null,
        changedBy: entry.changedBy,
      },
    });
  }

  async cancelStaleBefore(cutoff: Date, systemActorId: string): Promise<number> {
    const stale = await this.prisma.appointment.findMany({
      where: {
        // Every non-terminal status, not just PENDING/CONFIRMED — an
        // appointment already checked in (CHECKED_IN/IN_PROGRESS) whose
        // visit never finished must also close out here, or it's left
        // permanently stuck showing "Đang khám" on the patient's
        // "Lịch hẹn của tôi" page even after visitRepository.cancelStaleBefore
        // has already cancelled the linked visit out from under it.
        status: {
          in: [
            AppointmentStatus.PENDING,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.CHECKED_IN,
            AppointmentStatus.IN_PROGRESS,
          ],
        },
        appointmentTime: { lt: cutoff },
      },
      select: { id: true, status: true },
    });
    if (stale.length === 0) return 0;

    const cancelledAt = new Date();
    const reasonForStatus = (status: AppointmentStatus) =>
      status === AppointmentStatus.CHECKED_IN || status === AppointmentStatus.IN_PROGRESS
        ? 'Tự động hủy do hết ngày mà chưa hoàn tất khám'
        : 'Tự động hủy do hết ngày mà chưa được xác nhận/check-in';
    await this.prisma.$transaction(
      stale.flatMap((appt) => {
        const reason = reasonForStatus(appt.status as AppointmentStatus);
        return [
          this.prisma.appointment.update({
            where: { id: appt.id },
            data: {
              status: AppointmentStatus.CANCELLED,
              cancelReason: reason,
              cancelledBy: systemActorId,
              cancelledAt,
            },
          }),
          this.prisma.appointmentHistory.create({
            data: {
              appointmentId: appt.id,
              oldStatus: appt.status,
              newStatus: AppointmentStatus.CANCELLED,
              reason,
              changedBy: systemActorId,
            },
          }),
        ];
      }),
    );
    return stale.length;
  }

  async createVisit(data: CreateVisitData): Promise<Visit> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: data.roomId } });
    const { start, end } = this.todayRangeUtc();
    const countToday = await this.prisma.visit.count({
      where: { roomId: data.roomId, createdAt: { gte: start, lt: end } },
    });

    const row = await this.prisma.visit.create({
      data: {
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        doctorId: data.doctorId,
        roomId: data.roomId,
        queueNumber: this.formatQueueNumber(room.roomCode, countToday + 1),
        priority: data.priority ?? VisitPriority.NORMAL,
        status: VisitStatus.WAITING,
      },
    });

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

  async checkIn(data: CheckInData): Promise<CheckInResult> {
    return this.prisma.$transaction(async (tx) => {
      const appointmentRow = await tx.appointment.update({
        where: { id: data.appointmentId },
        data: {
          status: AppointmentStatus.CHECKED_IN,
          checkedInAt: data.checkedInAt,
          roomId: data.roomId,
        },
      });

      await tx.appointmentHistory.create({
        data: {
          appointmentId: data.appointmentId,
          oldStatus: data.oldStatus,
          newStatus: AppointmentStatus.CHECKED_IN,
          changedBy: data.changedBy,
        },
      });

      // Version-up 0.2 item #10: create the invoice (exam-fee line, UNPAID)
      // in the same transaction as the appointment update above — `data.invoice`
      // is undefined when the appointment has no serviceId (nothing to bill
      // yet). Idempotency guard: if an invoice already exists for this
      // appointment (shouldn't normally happen given the CONFIRMED-only
      // status guard in CheckInAppointmentUseCase, but defensive against any
      // retry/race), reuse it instead of hitting the appointmentId UNIQUE
      // constraint.
      let invoice: Invoice | null = null;
      if (data.invoice) {
        const existingInvoiceRow = await tx.invoice.findUnique({
          where: { appointmentId: data.appointmentId },
          include: { items: true },
        });
        if (existingInvoiceRow) {
          invoice = this.invoiceToDomain(existingInvoiceRow);
        } else {
          const item = data.invoice.item;
          for (let attempt = 0; attempt < INVOICE_CODE_GENERATION_ATTEMPTS; attempt += 1) {
            try {
              const invoiceRow = await tx.invoice.create({
                data: {
                  appointmentId: data.appointmentId,
                  patientId: data.patientId,
                  invoiceCode: InvoiceCode.generate().value,
                  subtotal: item.amount,
                  discount: 0,
                  total: item.amount,
                  amountDue: item.amount,
                  createdBy: data.invoice.createdBy,
                  items: {
                    create: [
                      {
                        itemType: item.itemType,
                        serviceRefId: item.serviceRefId ?? null,
                        clsRefId: item.clsRefId ?? null,
                        medicineRefId: item.medicineRefId ?? null,
                        name: item.name,
                        unitPrice: item.unitPrice,
                        quantity: item.quantity,
                        amount: item.amount,
                      },
                    ],
                  },
                },
                include: { items: true },
              });
              invoice = this.invoiceToDomain(invoiceRow);
              break;
            } catch (error) {
              const isInvoiceCodeConflict =
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002' &&
                String(error.meta?.target).includes('uq_invoices_code');
              if (!isInvoiceCodeConflict || attempt === INVOICE_CODE_GENERATION_ATTEMPTS - 1) throw error;
            }
          }
        }
      }

      return {
        appointment: this.toDomain(appointmentRow),
        invoice,
      };
    });
  }

  // Payment-before-queue change (2026-08-21): extracted from checkIn()'s old
  // Visit-creation block, now called separately by
  // ConfirmCheckInPaymentUseCase only once the exam fee is collected (or
  // there was nothing to collect). Keeps the same room-lock pattern so two
  // concurrent confirmations for the same room still serialize instead of
  // minting the same queueNumber.
  async createVisitForCheckIn(data: CreateVisitForCheckInData): Promise<Visit> {
    return this.prisma.$transaction(async (tx) => {
      // Locks the room row so two concurrent confirmations for the same room
      // serialize instead of both reading the same countToday and minting
      // the same queueNumber (queue_number has no unique constraint — it
      // intentionally resets per day, see schema.prisma comment on Visit).
      await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${data.roomId} FOR UPDATE`;
      const room = await tx.room.findUniqueOrThrow({ where: { id: data.roomId } });
      const { start, end } = this.todayRangeUtc();
      const countToday = await tx.visit.count({
        where: { roomId: data.roomId, createdAt: { gte: start, lt: end } },
      });

      const visitRow = await tx.visit.create({
        data: {
          appointmentId: data.appointmentId,
          patientId: data.patientId,
          doctorId: data.doctorId,
          roomId: data.roomId,
          queueNumber: this.formatQueueNumber(room.roomCode, countToday + 1),
          priority: data.priority ?? VisitPriority.NORMAL,
          status: VisitStatus.WAITING,
        },
      });

      return new Visit(
        visitRow.id,
        visitRow.appointmentId,
        visitRow.patientId,
        visitRow.doctorId,
        visitRow.roomId,
        visitRow.queueNumber,
        visitRow.priority as VisitPriority,
        visitRow.status as VisitStatus,
        visitRow.calledAt,
        visitRow.calledCount,
        visitRow.startedAt,
        visitRow.completedAt,
        visitRow.createdAt,
      );
    });
  }

  private invoiceToDomain(row: Prisma.InvoiceGetPayload<{ include: { items: true } }>): Invoice {
    return new Invoice(
      row.id,
      row.appointmentId,
      row.patientId,
      row.invoiceCode,
      Number(row.subtotal),
      Number(row.discount),
      Number(row.total),
      Number(row.amountDue),
      row.paymentStatus as PaymentStatus,
      row.paymentMethod as PaymentMethod | null,
      row.paidAt,
      row.note,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      row.items.map(
        (item) =>
          new InvoiceItem(
            item.id,
            item.invoiceId,
            item.itemType as InvoiceItemType,
            item.serviceRefId,
            item.clsRefId,
            item.medicineRefId,
            item.name,
            Number(item.unitPrice),
            item.quantity,
            Number(item.amount),
            item.paidAt,
          ),
      ),
    );
  }

  // Reset lúc 00:00 UTC — nhất quán với cách lọc theo ngày trong findMany().
  private todayRangeUtc(): { start: Date; end: Date } {
    const now = new Date();
    return {
      start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
    };
  }

  private formatQueueNumber(roomCode: string, sequence: number): string {
    return `${roomCode}-${String(sequence).padStart(3, '0')}`;
  }

  private toDomain(row: PrismaAppointment): Appointment {
    return new Appointment(
      row.id,
      row.patientId,
      row.doctorId,
      row.serviceId,
      row.roomId,
      row.scheduleId,
      row.appointmentTime,
      row.status as AppointmentStatus,
      row.note,
      row.cancelReason,
      row.cancelledBy,
      row.cancelledAt,
      row.checkedInAt,
      row.bookedBy,
      row.createdAt,
      row.updatedAt,
    );
  }
}
