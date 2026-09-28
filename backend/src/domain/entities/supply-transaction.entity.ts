import { SupplyTransactionType } from '../enums/supply-transaction-type.enum';

export class SupplyTransaction {
  constructor(
    public readonly id: string,
    public readonly supplyId: string,
    public readonly transactionType: SupplyTransactionType,
    // Sign convention (mirrors DB check chk_supply_tx_quantity, enforced
    // here since there is no DB trigger/constraint doing it):
    //   IMPORT     -> positive
    //   DISTRIBUTE -> negative
    public readonly quantity: number,
    public readonly importId: string | null,
    public readonly roomId: string | null,
    public readonly note: string | null,
    public readonly createdAt: Date,
    public readonly createdBy: string,
  ) {}
}
