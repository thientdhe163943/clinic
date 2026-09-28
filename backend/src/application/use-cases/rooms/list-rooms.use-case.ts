import { Inject, Injectable } from '@nestjs/common';
import { Room } from '../../../domain/entities/room.entity';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { RoomResponseDto } from '../../dtos/rooms/room-response.dto';

@Injectable()
export class ListRoomsUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(): Promise<RoomResponseDto[]> {
    const rooms = await this.roomRepository.findAll();

    const specialtyIds = [...new Set(rooms.map((r) => r.specialtyId).filter((id): id is string => !!id))];
    const specialties = await this.specialtyRepository.findByIds(specialtyIds);
    const nameById = new Map(specialties.map((s) => [s.id, s.name]));

    return rooms.map((room) => this.toDto(room, room.specialtyId ? nameById.get(room.specialtyId) : undefined));
  }

  private toDto(room: Room, specialtyName?: string): RoomResponseDto {
    return {
      id: room.id,
      code: room.roomCode,
      name: room.name,
      type: room.type as RoomType,
      status: room.isActive ? 'ACTIVE' : 'INACTIVE',
      description: room.description ?? undefined,
      techniqueType: room.techniqueType ?? undefined,
      clsCategory: (room.clsCategory as ClsRoomCategory) ?? undefined,
      specialtyId: room.specialtyId ?? undefined,
      specialtyName,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}
