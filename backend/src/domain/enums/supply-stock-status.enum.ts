// Feature 25's `status` query filter is not spelled out as an explicit enum
// in the spec ("Cảnh báo vật tư có tồn kho dưới mức tối thiểu"). We define it
// here as a simple two-value split on `currentStock` vs `minStockLevel`:
//   LOW_STOCK — currentStock < minStockLevel (low-stock badge per BR)
//   NORMAL    — currentStock >= minStockLevel
export enum SupplyStockStatus {
  LOW_STOCK = 'LOW_STOCK',
  NORMAL = 'NORMAL',
}
