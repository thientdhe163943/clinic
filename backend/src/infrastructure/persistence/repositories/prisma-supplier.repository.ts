import { Injectable } from '@nestjs/common';
import { Supplier as PrismaSupplier, Prisma } from '@prisma/client';
import { Supplier } from '../../../domain/entities/supplier.entity';
import {
  CreateSupplierData,
  SupplierListFilter,
  SupplierRepository,
  UpdateSupplierData,
} from '../../../domain/repositories/supplier.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findFirst({ where: { name, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByPhone(phone: string, excludeId?: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findFirst({
      where: { phone, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return row ? this.toDomain(row) : null;
  }

  async findByEmail(email: string, excludeId?: string): Promise<Supplier | null> {
    const row = await this.prisma.supplier.findFirst({
      where: { email, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return row ? this.toDomain(row) : null;
  }

  async findMany(filter: SupplierListFilter): Promise<{ items: Supplier[]; total: number }> {
    const search = filter.search?.trim();

    const where: Prisma.SupplierWhereInput = {
      deletedAt: null,
      ...(search ? { name: { contains: search } } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items: rows.map((row) => this.toDomain(row)), total };
  }

  async create(data: CreateSupplierData): Promise<Supplier> {
    const row = await this.prisma.supplier.create({
      data: {
        name: data.name,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        description: data.description ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateSupplierData): Promise<Supplier> {
    const row = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.description !== undefined && { description: data.description }),
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.supplier.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: deletedBy } });
  }

  async isInUse(id: string): Promise<boolean> {
    const count = await this.prisma.supplyImport.count({ where: { supplierId: id } });
    return count > 0;
  }

  private toDomain(row: PrismaSupplier): Supplier {
    return new Supplier(
      row.id,
      row.name,
      row.phone,
      row.email,
      row.address,
      row.description,
      row.createdAt,
      row.updatedAt,
      row.deletedAt,
    );
  }
}
