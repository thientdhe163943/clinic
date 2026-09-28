import { Inject, Injectable } from '@nestjs/common';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { ResourceNotFoundError } from '../../errors/application-error';
import { RoomResponseDto } from '../../dtos/rooms/room-response.dto';

@Injectable()
export class GetRoomByIdUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(id: string): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findById(id);
    if (!room) throw new ResourceNotFoundError('Room');

    const specialty = room.specialtyId ? await this.specialtyRepository.findById(room.specialtyId) : null;

    return {
      id: room.id,
      code: room.roomCode,
      name: room.name,
      type: room.type,
      status: room.isActive ? 'ACTIVE' : 'INACTIVE',
      description: room.description ?? undefined,
      specialtyId: room.specialtyId ?? undefined,
      specialtyName: specialty?.name ?? undefined,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}
