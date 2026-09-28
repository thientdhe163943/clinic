import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ResourceNotFoundError } from '../../errors/application-error';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ROOM_REPOSITORY, type RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, type SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import type { UpdateClsRoomDto } from '../../dtos/cls-rooms/cls-room.dto';
import { toClsRoomDto } from './cls-room.mapper';

@Injectable()
export class UpdateClsRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialties: SpecialtyRepository,
  ) {}

  async execute(input: UpdateClsRoomDto & { id: string; updatedBy: string }) {
    const room = await this.rooms.findById(input.id);
    if (!room || room.type !== RoomType.CLS) throw new ResourceNotFoundError('CLS room');
    const name = input.name.trim();
    if (await this.rooms.findByName(name, input.id)) throw new ConflictError('Tên phòng');
    const updated = await this.rooms.update(input.id, {
      name,
      type: RoomType.CLS,
      techniqueType: input.techniqueType.trim(),
      clsCategory: input.clsCategory,
      // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
      specialtyId: input.specialtyId,
      description: input.description?.trim(),
      updatedBy: input.updatedBy,
    });
    const specialty = updated.specialtyId ? await this.specialties.findById(updated.specialtyId) : null;
    return toClsRoomDto(updated, specialty?.name);
  }
}
