export interface SupplyImportItemResponseDto {
  supplyId: string;
  supplyName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  expiryDate: string | null;
  currentStock: number;
}

export interface SupplyImportResponseDto {
  id: string;
  supplierId: string;
  importDate: string;
  totalValue: number | null;
  items: SupplyImportItemResponseDto[];
}
