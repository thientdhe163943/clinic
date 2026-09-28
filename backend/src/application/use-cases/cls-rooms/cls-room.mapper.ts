import type { Room } from '../../../domain/entities/room.entity';
import type { RoomResponseDto } from '../../dtos/rooms/room-response.dto';

export function toClsRoomDto(room: Room, specialtyName?: string | null): RoomResponseDto {
  return {
    id: room.id,
    code: room.roomCode,
    name: room.name,
    type: room.type,
    status: room.isActive ? 'ACTIVE' : 'INACTIVE',
    description: room.description ?? undefined,
    techniqueType: room.techniqueType ?? undefined,
    clsCategory: room.clsCategory ?? undefined,
    specialtyId: room.specialtyId ?? undefined,
    specialtyName: specialtyName ?? undefined,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}
