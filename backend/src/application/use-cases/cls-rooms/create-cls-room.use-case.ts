import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../errors/application-error';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ROOM_REPOSITORY, type RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, type SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import type { CreateClsRoomDto } from '../../dtos/cls-rooms/cls-room.dto';
import { toClsRoomDto } from './cls-room.mapper';

@Injectable()
export class CreateClsRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialties: SpecialtyRepository,
  ) {}

  async execute(input: CreateClsRoomDto & { createdBy: string }) {
    const name = input.name.trim();
    if (await this.rooms.findByName(name)) throw new ConflictError('Tên phòng');
    const room = await this.rooms.create({
      roomCode: `CLS-${Date.now().toString(36).toUpperCase()}`,
      name,
      type: RoomType.CLS,
      techniqueType: input.techniqueType.trim(),
      clsCategory: input.clsCategory,
      specialtyId: input.specialtyId ?? null,
      description: input.description?.trim(),
      createdBy: input.createdBy,
    });
    const specialty = room.specialtyId ? await this.specialties.findById(room.specialtyId) : null;
    return toClsRoomDto(room, specialty?.name);
  }
}
