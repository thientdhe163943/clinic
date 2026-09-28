import { RoomType } from '../../../domain/enums/room-type.enum';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';

export class RoomResponseDto {
  id!: string;
  code!: string;
  name!: string;
  type!: RoomType;
  status!: 'ACTIVE' | 'INACTIVE';
  description?: string;
  techniqueType?: string;
  // Only set when type = CLS — which CLS specialty this room performs.
  clsCategory?: ClsRoomCategory;
  // Chuyên khoa (Specialty) this room belongs to — for room-picker filtering.
  specialtyId?: string;
  specialtyName?: string;
  createdAt!: Date;
  updatedAt!: Date;
}
