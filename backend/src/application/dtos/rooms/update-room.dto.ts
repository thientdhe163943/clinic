import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RoomType } from '../../../domain/enums/room-type.enum';

export class UpdateRoomRequestDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsEnum(RoomType)
  type!: RoomType;

  @IsOptional()
  @IsString()
  description?: string;

  // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
  @IsOptional()
  @IsString()
  specialtyId?: string | null;
}
