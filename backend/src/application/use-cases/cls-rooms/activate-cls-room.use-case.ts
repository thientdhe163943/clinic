import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../../errors/application-error';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ROOM_REPOSITORY, type RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, type SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { toClsRoomDto } from './cls-room.mapper';

@Injectable()
export class ActivateClsRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialties: SpecialtyRepository,
  ) {}
  async execute(id: string, updatedBy: string) {
    const room = await this.rooms.findById(id);
    if (!room || room.type !== RoomType.CLS) throw new ResourceNotFoundError('CLS room');
    const updated = room.isActive ? room : await this.rooms.setActive(id, true, updatedBy);
    const specialty = updated.specialtyId ? await this.specialties.findById(updated.specialtyId) : null;
    return toClsRoomDto(updated, specialty?.name);
  }
}
