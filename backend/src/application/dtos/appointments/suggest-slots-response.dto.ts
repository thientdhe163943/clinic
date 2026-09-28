export interface SuggestedSlotDto {
  doctorId: string;
  doctorName: string;
  serviceId: string;
  roomId: string | null;
  roomName: string | null;
  time: string;
  datetime: string;
  score: number;
  bookedCount: number;
  totalSlots: number;
  reason: string;
}
