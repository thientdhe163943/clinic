import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../../errors/application-error';
import { RoomResponseDto } from '../../dtos/rooms/room-response.dto';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';

@Injectable()
export class DeactivateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(id: string, updatedBy: string): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findById(id);
    if (!room) throw new ResourceNotFoundError('Room');

    const updated = await this.roomRepository.setActive(id, false, updatedBy);
    const specialty = updated.specialtyId ? await this.specialtyRepository.findById(updated.specialtyId) : null;
    return {
      id: updated.id,
      code: updated.roomCode,
      name: updated.name,
      type: updated.type,
      status: updated.isActive ? 'ACTIVE' : 'INACTIVE',
      description: updated.description ?? undefined,
      specialtyId: updated.specialtyId ?? undefined,
      specialtyName: specialty?.name ?? undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }
}
