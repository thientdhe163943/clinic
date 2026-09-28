import { Injectable } from '@nestjs/common';
import { SupplyCategory as PrismaSupplyCategory } from '@prisma/client';
import { SupplyCategory } from '../../../domain/entities/supply-category.entity';
import {
  CreateSupplyCategoryData,
  SupplyCategoryRepository,
  UpdateSupplyCategoryData,
} from '../../../domain/repositories/supply-category.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaSupplyCategoryRepository implements SupplyCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SupplyCategory | null> {
    const row = await this.prisma.supplyCategory.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string, excludeId?: string): Promise<SupplyCategory | null> {
    const row = await this.prisma.supplyCategory.findFirst({
      where: { name, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return row ? this.toDomain(row) : null;
  }

  async findMany(): Promise<SupplyCategory[]> {
    const rows = await this.prisma.supplyCategory.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async hasSupplies(categoryId: string): Promise<boolean> {
    const count = await this.prisma.supply.count({ where: { categoryId, deletedAt: null } });
    return count > 0;
  }

  async create(data: CreateSupplyCategoryData): Promise<SupplyCategory> {
    const row = await this.prisma.supplyCategory.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateSupplyCategoryData): Promise<SupplyCategory> {
    const row = await this.prisma.supplyCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.supplyCategory.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }

  private toDomain(row: PrismaSupplyCategory): SupplyCategory {
    return new SupplyCategory(
      row.id,
      row.name,
      row.description,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      row.updatedBy,
    );
  }
}
