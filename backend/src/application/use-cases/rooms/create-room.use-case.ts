import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../errors/application-error';
import { CreateRoomRequestDto } from '../../dtos/rooms/create-room.dto';
import { RoomResponseDto } from '../../dtos/rooms/room-response.dto';
import { CreateRoomData, ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';

export interface CreateRoomInput extends CreateRoomRequestDto {
  createdBy: string;
}

@Injectable()
export class CreateRoomUseCase {
  constructor(
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(input: CreateRoomInput): Promise<RoomResponseDto> {
    const existing = await this.roomRepository.findByCode(input.code);
    if (existing) throw new ConflictError('Mã phòng');

    const room = await this.roomRepository.create({
      roomCode: input.code,
      name: input.name,
      type: input.type,
      description: input.description,
      specialtyId: input.specialtyId ?? null,
      createdBy: input.createdBy,
    } as CreateRoomData);

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
