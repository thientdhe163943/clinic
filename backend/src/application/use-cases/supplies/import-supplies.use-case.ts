import { Inject, Injectable } from '@nestjs/common';
import { SupplyImportResponseDto } from '../../dtos/supplies/supply-import-response.dto';
import { InvalidQuantityError, ResourceNotFoundError } from '../../errors/application-error';
import { SUPPLY_REPOSITORY, SupplyRepository } from '../../../domain/repositories/supply.repository';
import { Money } from '../../../domain/value-objects/money.vo';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface ImportSupplyLineInput {
  supplyId: string;
  quantity: number;
  unitPrice: number;
  expiryDate?: string;
}

export interface ImportSuppliesInput {
  supplierId: string;
  items: ImportSupplyLineInput[];
  createdBy: string;
}

@Injectable()
export class ImportSuppliesUseCase {
  constructor(
    @Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository,
    // No SupplierRepository exists yet (Supplier CRUD is a separate module,
    // out of scope here) — the FK is read straight off PrismaService, same
    // approach CreateInvoiceUseCase uses for medicine price lookups.
    private readonly prisma: PrismaService,
  ) {}

  async execute(input: ImportSuppliesInput): Promise<SupplyImportResponseDto> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, deletedAt: null },
    });
    if (!supplier) throw new ResourceNotFoundError('Supplier', { id: input.supplierId });

    const supplyById = new Map<string, Awaited<ReturnType<SupplyRepository['findById']>>>();
    for (const item of input.items) {
      // Feature 28 BR: "Số lượng nhập phải > 0."
      if (item.quantity <= 0) throw new InvalidQuantityError();
      // Validates unitPrice is a finite non-negative amount.
      Money.of(item.unitPrice);

      if (!supplyById.has(item.supplyId)) {
        const supply = await this.supplyRepository.findById(item.supplyId);
        if (!supply) throw new ResourceNotFoundError('Supply', { id: item.supplyId });
        supplyById.set(item.supplyId, supply);
      }
    }

    const importResult = await this.supplyRepository.importBatch({
      supplierId: input.supplierId,
      items: input.items.map((item) => ({
        supplyId: item.supplyId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
      })),
      createdBy: input.createdBy,
    });

    // Re-read post-import stock straight from the repository (rather than
    // computing pre-import stock + quantity in memory) so the response
    // reflects the actual row-locked write, not a stale in-memory guess.
    const updatedSupplyIds = [...new Set(importResult.items.map((item) => item.supplyId))];
    const updatedSupplies = await Promise.all(updatedSupplyIds.map((id) => this.supplyRepository.findById(id)));
    const updatedById = new Map(updatedSupplies.filter((s) => s !== null).map((s) => [s!.id, s!]));

    return {
      id: importResult.id,
      supplierId: importResult.supplierId,
      importDate: importResult.importDate.toISOString(),
      totalValue: importResult.totalValue,
      items: importResult.items.map((item) => {
        const supply = supplyById.get(item.supplyId)!;
        const updated = updatedById.get(item.supplyId);
        return {
          supplyId: item.supplyId,
          supplyName: supply.name,
          unit: supply.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          expiryDate: item.expiryDate ? item.expiryDate.toISOString() : null,
          currentStock: updated?.currentStock ?? supply.currentStock + item.quantity,
        };
      }),
    };
  }
}
