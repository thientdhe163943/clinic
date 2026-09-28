import { Room } from '../entities/room.entity';
import { RoomType } from '../enums/room-type.enum';
import { ClsRoomCategory } from '../enums/cls-room-category.enum';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');

export interface CreateRoomData {
  roomCode: string;
  name: string;
  type: RoomType;
  description?: string;
  techniqueType?: string;
  clsCategory?: ClsRoomCategory | null;
  specialtyId?: string | null;
  createdBy: string;
}

export interface UpdateRoomData {
  name: string;
  type: RoomType;
  description?: string;
  techniqueType?: string;
  clsCategory?: ClsRoomCategory | null;
  // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
  specialtyId?: string | null;
  updatedBy?: string;
}

export interface RoomRepository {
  findAll(): Promise<Room[]>;
  findAllByType(type: RoomType, isActive?: boolean): Promise<Room[]>;
  findAllByClsCategory(category: ClsRoomCategory, isActive?: boolean): Promise<Room[]>;
  findById(id: string): Promise<Room | null>;
  findByCode(code: string): Promise<Room | null>;
  findByName(name: string, excludeId?: string): Promise<Room | null>;
  countUnfinishedClsOrders(roomId: string): Promise<number>;
  create(data: CreateRoomData): Promise<Room>;
  update(id: string, data: UpdateRoomData): Promise<Room>;
  setActive(id: string, isActive: boolean, updatedBy?: string): Promise<Room>;
}
