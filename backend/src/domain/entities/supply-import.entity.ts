export class SupplyImportItem {
  constructor(
    public readonly id: string,
    public readonly importId: string,
    public readonly supplyId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly expiryDate: Date | null,
  ) {}
}

export class SupplyImport {
  constructor(
    public readonly id: string,
    public readonly supplierId: string,
    public readonly importDate: Date,
    public readonly totalValue: number | null,
    public readonly createdAt: Date,
    public readonly createdBy: string,
    public readonly items: SupplyImportItem[],
  ) {}
}
