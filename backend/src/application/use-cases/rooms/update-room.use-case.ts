import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../../errors/application-error';
import { UpdateRoomRequestDto } from '../../dtos/rooms/update-room.dto';
import { RoomResponseDto } from '../../dtos/rooms/room-response.dto';
import { ROOM_REPOSITORY, RoomRepository, UpdateRoomData } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';

export interface UpdateRoomInput extends UpdateRoomRequestDto {
  id: string;
  updatedBy: string;
}

@Injectable()
export class UpdateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(input: UpdateRoomInput): Promise<RoomResponseDto> {
    const room = await this.roomRepository.findById(input.id);
    if (!room) throw new ResourceNotFoundError('Room');

    const updated = await this.roomRepository.update(input.id, {
      name: input.name,
      type: input.type,
      description: input.description,
      // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
      specialtyId: input.specialtyId,
      updatedBy: input.updatedBy,
    } as UpdateRoomData);

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
