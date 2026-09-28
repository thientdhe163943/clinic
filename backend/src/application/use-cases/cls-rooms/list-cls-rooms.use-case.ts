import { Inject, Injectable } from '@nestjs/common';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { ROOM_REPOSITORY, type RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, type SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { toClsRoomDto } from './cls-room.mapper';

@Injectable()
export class ListClsRoomsUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialties: SpecialtyRepository,
  ) {}
  async execute(status?: 'ACTIVE' | 'INACTIVE', category?: ClsRoomCategory) {
    const isActive = status ? status === 'ACTIVE' : undefined;
    const rows = category
      ? await this.rooms.findAllByClsCategory(category, isActive)
      : await this.rooms.findAllByType(RoomType.CLS, isActive);

    const specialtyIds = [...new Set(rows.map((r) => r.specialtyId).filter((id): id is string => !!id))];
    const specialties = await this.specialties.findByIds(specialtyIds);
    const nameById = new Map(specialties.map((s) => [s.id, s.name]));

    return rows.map((room) => toClsRoomDto(room, room.specialtyId ? nameById.get(room.specialtyId) : undefined));
  }
}
