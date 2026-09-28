import { Injectable } from '@nestjs/common';
import { AppointmentStatus, PaymentStatus, Service as PrismaService } from '@prisma/client';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { Service } from '../../../domain/entities/service.entity';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import {
  CreateServiceData,
  ServiceListFilter,
  ServiceRepository,
  UpdateServiceData,
} from '../../../domain/repositories/service.repository';
import { PrismaService as PrismaClient } from '../prisma/prisma.service';

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

const UNPAID_INVOICE_STATUSES: PaymentStatus[] = [
  PaymentStatus.UNPAID,
  PaymentStatus.PARTIALLY_PAID,
];

@Injectable()
export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Service | null> {
    const row = await this.prisma.service.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string): Promise<Service | null> {
    const row = await this.prisma.service.findFirst({ where: { name, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Service | null> {
    const row = await this.prisma.service.findFirst({ where: { serviceCode: code, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async count(): Promise<number> {
    return this.prisma.service.count();
  }

  async findMany(filter: ServiceListFilter): Promise<{ items: Service[]; total: number }> {
    const where = {
      deletedAt: null,
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.clsCategory ? { clsCategory: filter.clsCategory } : {}),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search } },
              { serviceCode: { contains: filter.search } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.service.count({ where }),
    ]);

    return { items: rows.map(this.toDomain), total };
  }

  async create(data: CreateServiceData): Promise<Service> {
    const row = await this.prisma.service.create({
      data: {
        serviceCode: data.serviceCode,
        name: data.name,
        specialtyId: data.specialtyId ?? null,
        type: data.type ?? 'EXAMINATION',
        clsCategory: data.clsCategory ?? null,
        price: data.price,
        description: data.description ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateServiceData): Promise<Service> {
    const row = await this.prisma.service.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.specialtyId !== undefined && { specialtyId: data.specialtyId }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.clsCategory !== undefined && { clsCategory: data.clsCategory }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }

  async isInUse(id: string): Promise<boolean> {
    const activeAppointment = await this.prisma.appointment.count({
      where: { serviceId: id, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
    });
    if (activeAppointment > 0) return true;

    const unpaidInvoiceItem = await this.prisma.invoiceItem.count({
      where: {
        serviceRefId: id,
        invoice: { paymentStatus: { in: UNPAID_INVOICE_STATUSES } },
      },
    });
    return unpaidInvoiceItem > 0;
  }

  private toDomain(row: PrismaService): Service {
    return new Service(
      row.id,
      row.serviceCode,
      row.name,
      row.specialtyId,
      row.type as ServiceType,
      row.clsCategory as ClsRoomCategory | null,
      Number(row.price),
      row.description,
      row.isActive,
      row.createdAt,
      row.updatedAt,
      row.deletedAt,
    );
  }
}
