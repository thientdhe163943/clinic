import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Supply as PrismaSupply,
  SupplyImport as PrismaSupplyImport,
  SupplyImportItem as PrismaSupplyImportItem,
  SupplyTransaction as PrismaSupplyTransaction,
} from '@prisma/client';
import { InsufficientStockError } from '../../../application/errors/application-error';
import { SupplyImport, SupplyImportItem } from '../../../domain/entities/supply-import.entity';
import { Supply } from '../../../domain/entities/supply.entity';
import { SupplyTransaction } from '../../../domain/entities/supply-transaction.entity';
import { SupplyStockStatus } from '../../../domain/enums/supply-stock-status.enum';
import { SupplyTransactionType } from '../../../domain/enums/supply-transaction-type.enum';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';
import {
  CreateSupplyData,
  DistributeSupplyData,
  DistributeSupplyResult,
  ImportSupplyData,
  SupplyListFilter,
  SupplyListItem,
  SupplyRepository,
  SupplyTransactionFilter,
  SupplyTransactionListItem,
  UpdateSupplyData,
} from '../../../domain/repositories/supply.repository';
import { PrismaService } from '../prisma/prisma.service';

type SupplyImportRow = PrismaSupplyImport & { items: PrismaSupplyImportItem[] };

@Injectable()
export class PrismaSupplyRepository implements SupplyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Supply | null> {
    const row = await this.prisma.supply.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByNameInCategory(name: string, categoryId: string, excludeId?: string): Promise<Supply | null> {
    const row = await this.prisma.supply.findFirst({
      where: { name, categoryId, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return row ? this.toDomain(row) : null;
  }

  // NOTE: Prisma Client cannot compare two columns of the same row directly
  // in a `where` filter (e.g. currentStock < minStockLevel) without raw SQL.
  // Supply catalogues are small (tens/low hundreds of rows per clinic), so we
  // fetch the category/search-filtered set and apply the LOW_STOCK/NORMAL
  // split + pagination in memory rather than hand-rolling a raw query.
  async findMany(filter: SupplyListFilter): Promise<{ items: SupplyListItem[]; total: number }> {
    const search = filter.search?.trim();

    const where: Prisma.SupplyWhereInput = {
      deletedAt: null,
      ...(filter.categoryId ? { categoryId: filter.categoryId } : {}),
      ...(search ? { name: { contains: search } } : {}),
    };

    const rows = await this.prisma.supply.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });

    const filteredRows = filter.status
      ? rows.filter((row) =>
          filter.status === SupplyStockStatus.LOW_STOCK
            ? row.currentStock < row.minStockLevel
            : row.currentStock >= row.minStockLevel,
        )
      : rows;

    const total = filteredRows.length;
    const start = (filter.page - 1) * filter.limit;
    const pageRows = filteredRows.slice(start, start + filter.limit);

    return {
      items: pageRows.map((row) => ({ supply: this.toDomain(row), categoryName: row.category.name })),
      total,
    };
  }

  async hasTransactions(supplyId: string): Promise<boolean> {
    const count = await this.prisma.supplyTransaction.count({ where: { supplyId } });
    return count > 0;
  }

  async create(data: CreateSupplyData): Promise<Supply> {
    const row = await this.prisma.supply.create({
      data: {
        categoryId: data.categoryId,
        name: data.name,
        unit: data.unit,
        minStockLevel: data.minStockLevel,
        description: data.description ?? null,
        currentStock: 0,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateSupplyData): Promise<Supply> {
    const row = await this.prisma.supply.update({
      where: { id },
      data: {
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.minStockLevel !== undefined && { minStockLevel: data.minStockLevel }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.supply.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: deletedBy },
    });
  }

  async findTransactions(
    supplyId: string,
    filter: SupplyTransactionFilter,
  ): Promise<{ items: SupplyTransactionListItem[]; total: number }> {
    const where: Prisma.SupplyTransactionWhereInput = {
      supplyId,
      ...(filter.type ? { transactionType: filter.type } : {}),
      ...(filter.from || filter.to
        ? {
            createdAt: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.supplyTransaction.findMany({
        where,
        include: { room: true },
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.supplyTransaction.count({ where }),
    ]);

    // supply_transactions.created_by has no Prisma relation to users, so
    // actor names are resolved with a separate bulk lookup (same approach
    // ListServicesUseCase uses for specialty names).
    const actorIds = [...new Set(rows.map((row) => row.createdBy))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, fullName: true } })
      : [];
    const actorNameById = new Map(actors.map((actor) => [actor.id, actor.fullName]));

    return {
      items: rows.map((row) => ({
        transaction: this.toTransactionDomain(row),
        actorName: actorNameById.get(row.createdBy) ?? 'N/A',
        roomName: row.room?.name ?? null,
      })),
      total,
    };
  }

  async importBatch(data: ImportSupplyData): Promise<SupplyImport> {
    return this.prisma.$transaction(async (tx) => {
      // Lock every referenced supply row up front (sorted by id so
      // concurrent imports/distributions touching overlapping supply sets
      // always acquire locks in the same order and cannot deadlock) before
      // any read/increment of currentStock — mirrors the room-lock pattern
      // in PrismaAppointmentRepository.checkIn().
      const supplyIds = [...new Set(data.items.map((item) => item.supplyId))].sort();
      for (const supplyId of supplyIds) {
        await tx.$queryRaw`SELECT id FROM supplies WHERE id = ${supplyId} FOR UPDATE`;
      }

      const totalValue = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const importRow = await tx.supplyImport.create({
        data: {
          supplierId: data.supplierId,
          totalValue,
          createdBy: data.createdBy,
          items: {
            create: data.items.map((item) => ({
              supplyId: item.supplyId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              expiryDate: item.expiryDate ?? null,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of data.items) {
        await tx.supplyTransaction.create({
          data: {
            supplyId: item.supplyId,
            transactionType: SupplyTransactionType.IMPORT,
            quantity: item.quantity,
            importId: importRow.id,
            createdBy: data.createdBy,
          },
        });

        await tx.supply.update({
          where: { id: item.supplyId },
          data: { currentStock: { increment: item.quantity } },
        });
      }

      return this.toImportDomain(importRow);
    });
  }

  async distribute(data: DistributeSupplyData): Promise<DistributeSupplyResult> {
    return this.prisma.$transaction(async (tx) => {
      // Locks the supply row so two concurrent distributions cannot both
      // read the same stale currentStock and both pass the
      // `currentStock - quantity >= 0` check.
      await tx.$queryRaw`SELECT id FROM supplies WHERE id = ${data.supplyId} FOR UPDATE`;
      const supply = await tx.supply.findUniqueOrThrow({ where: { id: data.supplyId } });

      const nextStock = supply.currentStock - data.quantity;
      if (nextStock < 0) {
        throw new InsufficientStockError(supply.currentStock, supply.unit, data.quantity);
      }

      const transactionRow = await tx.supplyTransaction.create({
        data: {
          supplyId: data.supplyId,
          transactionType: SupplyTransactionType.DISTRIBUTE,
          quantity: -data.quantity,
          roomId: data.roomId,
          createdBy: data.createdBy,
        },
      });

      await tx.supply.update({
        where: { id: data.supplyId },
        data: { currentStock: nextStock },
      });

      return {
        transaction: this.toTransactionDomain(transactionRow),
        currentStock: nextStock,
        supplyName: supply.name,
        unit: supply.unit,
      };
    });
  }

  private toDomain(row: PrismaSupply): Supply {
    return new Supply(
      row.id,
      row.categoryId,
      row.name,
      row.unit as MeasurementUnit,
      row.currentStock,
      row.minStockLevel,
      row.description,
      row.isActive,
      row.createdAt,
      row.updatedAt,
      row.createdBy,
      row.updatedBy,
    );
  }

  private toTransactionDomain(row: PrismaSupplyTransaction): SupplyTransaction {
    return new SupplyTransaction(
      row.id,
      row.supplyId,
      row.transactionType as SupplyTransactionType,
      row.quantity,
      row.importId,
      row.roomId,
      row.note,
      row.createdAt,
      row.createdBy,
    );
  }

  private toImportDomain(row: SupplyImportRow): SupplyImport {
    return new SupplyImport(
      row.id,
      row.supplierId,
      row.importDate,
      row.totalValue ? Number(row.totalValue) : null,
      row.createdAt,
      row.createdBy,
      row.items.map(
        (item) =>
          new SupplyImportItem(
            item.id,
            item.importId,
            item.supplyId,
            item.quantity,
            Number(item.unitPrice),
            item.expiryDate,
          ),
      ),
    );
  }
}
