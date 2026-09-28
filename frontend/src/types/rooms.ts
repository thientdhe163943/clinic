export type RoomType = 'EXAMINATION' | 'CLS' | 'ADMIN';
export type RoomStatus = 'ACTIVE' | 'INACTIVE';
// Only meaningful when type = CLS — which CLS specialty this room performs.
export type ClsRoomCategory = 'LAB' | 'XRAY' | 'ULTRASOUND' | 'ECG';

export interface Room {
  id: string;
  code: string;
  name: string;
  type: RoomType;
  status: RoomStatus;
  description?: string;
  techniqueType?: string;
  clsCategory?: ClsRoomCategory;
  // Optional specialty a room is grouped under — independent of (but usually
  // aligned with) clsCategory for CLS rooms. Denormalized name comes from
  // the backend alongside the id so list/detail views don't need a lookup.
  specialtyId?: string | null;
  specialtyName?: string | null;
}

export interface SaveClsRoomRequest {
  name: string;
  techniqueType: string;
  clsCategory: ClsRoomCategory;
  description?: string;
  specialtyId?: string | null;
}

export interface DeactivateClsRoomResponse {
  requiresConfirmation: boolean;
  unfinishedOrders: number;
  room: Room;
}

export interface CreateRoomRequest {
  code: string;
  name: string;
  type: RoomType;
  description?: string;
  specialtyId?: string;
}

export interface UpdateRoomRequest {
  name: string;
  type: RoomType;
  description?: string;
  specialtyId?: string | null;
}
