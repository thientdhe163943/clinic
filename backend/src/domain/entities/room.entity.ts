import { RoomType } from '../enums/room-type.enum';
import { ClsRoomCategory } from '../enums/cls-room-category.enum';

export class Room {
  constructor(
    public readonly id: string,
    public readonly roomCode: string,
    public readonly name: string,
    public readonly type: RoomType,
    public readonly description: string | null,
    public readonly techniqueType: string | null,
    public readonly clsCategory: ClsRoomCategory | null,
    public readonly specialtyId: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
