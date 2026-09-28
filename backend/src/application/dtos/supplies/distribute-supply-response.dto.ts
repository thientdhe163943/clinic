export interface DistributeSupplyResponseDto {
  transactionId: string;
  supplyId: string;
  supplyName: string;
  unit: string;
  roomId: string;
  roomName: string;
  quantity: number;
  currentStock: number;
  createdAt: string;
}
