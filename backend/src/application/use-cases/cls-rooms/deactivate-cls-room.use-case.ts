import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../../errors/application-error';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ROOM_REPOSITORY, type RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, type SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { toClsRoomDto } from './cls-room.mapper';

@Injectable()
export class DeactivateClsRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly rooms: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialties: SpecialtyRepository,
  ) {}
  async execute(id: string, updatedBy: string, confirm = false) {
    const room = await this.rooms.findById(id);
    if (!room || room.type !== RoomType.CLS) throw new ResourceNotFoundError('CLS room');
    const specialtyName = async (r: typeof room) => (r.specialtyId ? (await this.specialties.findById(r.specialtyId))?.name : undefined);
    if (!room.isActive) {
      return { requiresConfirmation: false, unfinishedOrders: 0, room: toClsRoomDto(room, await specialtyName(room)) };
    }
    const unfinishedOrders = await this.rooms.countUnfinishedClsOrders(id);
    if (unfinishedOrders > 0 && !confirm) {
      return { requiresConfirmation: true, unfinishedOrders, room: toClsRoomDto(room, await specialtyName(room)) };
    }
    const updated = await this.rooms.setActive(id, false, updatedBy);
    return { requiresConfirmation: false, unfinishedOrders, room: toClsRoomDto(updated, await specialtyName(updated)) };
  }
}
