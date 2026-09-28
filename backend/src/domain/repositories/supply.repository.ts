import { SupplyImport } from '../entities/supply-import.entity';
import { Supply } from '../entities/supply.entity';
import { SupplyTransaction } from '../entities/supply-transaction.entity';
import { SupplyStockStatus } from '../enums/supply-stock-status.enum';
import { SupplyTransactionType } from '../enums/supply-transaction-type.enum';
import { MeasurementUnit } from '../enums/measurement-unit.enum';

export const SUPPLY_REPOSITORY = Symbol('SUPPLY_REPOSITORY');

export interface CreateSupplyData {
  categoryId: string;
  name: string;
  unit: MeasurementUnit;
  minStockLevel: number;
  description?: string | null;
  createdBy: string;
}

export interface UpdateSupplyData {
  categoryId?: string;
  name?: string;
  unit?: MeasurementUnit;
  minStockLevel?: number;
  description?: string | null;
  isActive?: boolean;
  updatedBy: string;
}

export interface SupplyListFilter {
  categoryId?: string;
  status?: SupplyStockStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface SupplyListItem {
  supply: Supply;
  categoryName: string;
}

export interface SupplyTransactionFilter {
  from?: Date;
  to?: Date;
  type?: SupplyTransactionType;
  page: number;
  limit: number;
}

export interface SupplyTransactionListItem {
  transaction: SupplyTransaction;
  actorName: string;
  roomName: string | null;
}

export interface ImportSupplyLine {
  supplyId: string;
  quantity: number;
  unitPrice: number;
  expiryDate?: Date | null;
}

export interface ImportSupplyData {
  supplierId: string;
  items: ImportSupplyLine[];
  createdBy: string;
}

export interface DistributeSupplyData {
  supplyId: string;
  roomId: string;
  quantity: number;
  createdBy: string;
}

export interface DistributeSupplyResult {
  transaction: SupplyTransaction;
  currentStock: number;
  supplyName: string;
  unit: string;
}

export interface SupplyRepository {
  findById(id: string): Promise<Supply | null>;
  findByNameInCategory(name: string, categoryId: string, excludeId?: string): Promise<Supply | null>;
  findMany(filter: SupplyListFilter): Promise<{ items: SupplyListItem[]; total: number }>;
  /** Feature 26 guard — true if any supply_transactions row references this supply. */
  hasTransactions(supplyId: string): Promise<boolean>;
  create(data: CreateSupplyData): Promise<Supply>;
  update(id: string, data: UpdateSupplyData): Promise<Supply>;
  softDelete(id: string, deletedBy: string): Promise<void>;

  findTransactions(
    supplyId: string,
    filter: SupplyTransactionFilter,
  ): Promise<{ items: SupplyTransactionListItem[]; total: number }>;

  /**
   * Feature 28 — creates SupplyImport + SupplyImportItem rows, one IMPORT
   * SupplyTransaction per line, and increments Supply.currentStock for each
   * line — all inside a single Prisma transaction with a row-locked read of
   * each Supply row first (there is no DB trigger doing this, see
   * schema.prisma's comment on fn_update_supply_stock).
   */
  importBatch(data: ImportSupplyData): Promise<SupplyImport>;

  /**
   * Feature 29 — creates a DISTRIBUTE SupplyTransaction (negative quantity)
   * and decrements Supply.currentStock, inside a row-locked transaction so
   * concurrent distributions of the same supply cannot both read a stale
   * currentStock. Throws InsufficientStockError (checked under the lock) if
   * currentStock - quantity < 0.
   */
  distribute(data: DistributeSupplyData): Promise<DistributeSupplyResult>;
}
