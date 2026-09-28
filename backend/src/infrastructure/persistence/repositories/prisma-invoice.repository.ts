import { Injectable } from '@nestjs/common';
import { Invoice as PrismaInvoice, InvoiceItem as PrismaInvoiceItem, Prisma } from '@prisma/client';
import { Invoice, InvoiceItem } from '../../../domain/entities/invoice.entity';
import { InvoiceItemType } from '../../../domain/enums/invoice-item-type.enum';
import { PaymentMethod } from '../../../domain/enums/payment-method.enum';
import { PaymentStatus } from '../../../domain/enums/payment-status.enum';
import {
  AppendInvoiceItemsData,
  CreateInvoiceData,
  InvoiceListFilter,
  InvoiceListItem,
  InvoiceRepository,
  PayInvoiceItemsData,
  UpdateInvoiceItemData,
} from '../../../domain/repositories/invoice.repository';
import { PrismaService } from '../prisma/prisma.service';

type InvoiceRow = PrismaInvoice & { items: PrismaInvoiceItem[] };

@Injectable()
export class PrismaInvoiceRepository implements InvoiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findUnique({ where: { id }, include: { items: true } });
    return row ? this.toDomain(row) : null;
  }

  async findByAppointmentId(appointmentId: string): Promise<Invoice | null> {
    const row = await this.prisma.invoice.findUnique({ where: { appointmentId }, include: { items: true } });
    return row ? this.toDomain(row) : null;
  }

  async findItemByClsRefId(clsRefId: string): Promise<InvoiceItem | null> {
    const row = await this.prisma.invoiceItem.findFirst({ where: { clsRefId } });
    return row ? this.toItemDomain(row) : null;
  }

  async findMany(filter: InvoiceListFilter): Promise<{ items: InvoiceListItem[]; total: number }> {
    const search = filter.search?.trim();

    const where: Prisma.InvoiceWhereInput = {
      ...(filter.paymentStatus ? { paymentStatus: filter.paymentStatus } : {}),
      ...(search
        ? {
            OR: [
              { patient: { fullName: { contains: search } } },
              { patient: { patientCode: { contains: search } } },
              { patient: { phone: { contains: search } } },
              { patient: { idCard: { contains: search } } },
              { invoiceCode: { contains: search } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: { items: true, patient: true },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const items: InvoiceListItem[] = rows.map((row) => ({
      invoice: this.toDomain(row),
      patientName: row.patient.fullName,
      patientCode: row.patient.patientCode,
    }));

    return { items, total };
  }

  async create(data: CreateInvoiceData): Promise<Invoice> {
    const row = await this.prisma.invoice.create({
      data: {
        appointmentId: data.appointmentId,
        patientId: data.patientId,
        invoiceCode: data.invoiceCode,
        subtotal: data.subtotal,
        discount: data.discount,
        total: data.total,
        amountDue: data.amountDue,
        note: data.note ?? null,
        createdBy: data.createdBy,
        items: {
          create: data.items.map((item) => ({
            itemType: item.itemType,
            serviceRefId: item.serviceRefId ?? null,
            clsRefId: item.clsRefId ?? null,
            medicineRefId: item.medicineRefId ?? null,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            amount: item.amount,
          })),
        },
      },
      include: { items: true },
    });
    return this.toDomain(row);
  }

  async appendItems(data: AppendInvoiceItemsData): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.createMany({
        data: data.items.map((item) => ({
          invoiceId: data.invoiceId,
          itemType: item.itemType,
          serviceRefId: item.serviceRefId ?? null,
          clsRefId: item.clsRefId ?? null,
          medicineRefId: item.medicineRefId ?? null,
          name: item.name,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          amount: item.amount,
        })),
      });

      const current = await tx.invoice.findUniqueOrThrow({
        where: { id: data.invoiceId },
        include: { items: true },
      });
      const { subtotal, total, amountDue, paymentStatus } = this.recompute(current.items, Number(current.discount));

      const updated = await tx.invoice.update({
        where: { id: data.invoiceId },
        data: { subtotal, total, amountDue, paymentStatus },
        include: { items: true },
      });
      return this.toDomain(updated);
    });
  }

  async payItems(data: PayInvoiceItemsData): Promise<Invoice> {
    return this.prisma.$transaction(async (tx) => {
      await tx.invoiceItem.updateMany({
        where: { id: { in: data.itemIds }, invoiceId: data.invoiceId },
        data: { paidAt: data.paidAt },
      });

      await tx.invoicePayment.create({
        data: {
          invoiceId: data.invoiceId,
          amount: data.amount,
          method: data.method,
          paidAt: data.paidAt,
          createdBy: data.createdBy,
          note: data.note ?? null,
          items: { create: data.itemIds.map((invoiceItemId) => ({ invoiceItemId })) },
        },
      });

      const current = await tx.invoice.findUniqueOrThrow({
        where: { id: data.invoiceId },
        include: { items: true },
      });
      const { subtotal, total, amountDue, paymentStatus } = this.recompute(current.items, Number(current.discount));

      const updated = await tx.invoice.update({
        where: { id: data.invoiceId },
        data: {
          subtotal,
          total,
          amountDue,
          paymentStatus,
          // Invoice.paymentMethod/paidAt only ever reflected a single
          // all-at-once payment historically — now kept as a best-effort
          // "most recent round" snapshot; InvoicePayment rows are the source
          // of truth for the full multi-round history.
          paymentMethod: data.method,
          paidAt: paymentStatus === PaymentStatus.PAID ? data.paidAt : current.paidAt,
        },
        include: { items: true },
      });
      return this.toDomain(updated);
    });
  }

  async updateItemByClsRefId(clsRefId: string, data: UpdateInvoiceItemData): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.invoiceItem.findFirst({ where: { clsRefId } });
      if (!item) return;

      await tx.invoiceItem.update({
        where: { id: item.id },
        data: { name: data.name, unitPrice: data.unitPrice, amount: data.amount },
      });

      const current = await tx.invoice.findUniqueOrThrow({
        where: { id: item.invoiceId },
        include: { items: true },
      });
      const { subtotal, total, amountDue, paymentStatus } = this.recompute(
        current.items.map((i) => (i.id === item.id ? { ...i, amount: new Prisma.Decimal(data.amount) } : i)),
        Number(current.discount),
      );
      await tx.invoice.update({
        where: { id: item.invoiceId },
        data: { subtotal, total, amountDue, paymentStatus },
      });
    });
  }

  /**
   * Recomputes subtotal/total/amountDue/paymentStatus from the current full
   * set of InvoiceItem rows (paid + unpaid). amountDue = total - (sum of
   * already-paid item amounts); discount (if any, set at invoice creation)
   * is applied against the total rather than distributed per item.
   */
  private recompute(
    items: PrismaInvoiceItem[],
    discount: number,
  ): { subtotal: number; total: number; amountDue: number; paymentStatus: PaymentStatus } {
    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0);
    const total = Math.max(subtotal - discount, 0);
    const paidAmount = items.filter((item) => item.paidAt).reduce((sum, item) => sum + Number(item.amount), 0);
    const amountDue = Math.max(total - paidAmount, 0);

    let paymentStatus: PaymentStatus;
    if (items.length === 0 || paidAmount === 0) {
      paymentStatus = PaymentStatus.UNPAID;
    } else if (amountDue === 0) {
      paymentStatus = PaymentStatus.PAID;
    } else {
      paymentStatus = PaymentStatus.PARTIALLY_PAID;
    }

    return { subtotal, total, amountDue, paymentStatus };
  }

  private toItemDomain(item: PrismaInvoiceItem): InvoiceItem {
    return new InvoiceItem(
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
    );
  }

  private toDomain(row: InvoiceRow): Invoice {
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
      row.items.map((item) => this.toItemDomain(item)),
    );
  }
}
