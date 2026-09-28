import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RoomType } from '../../../domain/enums/room-type.enum';

export class CreateRoomRequestDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsEnum(RoomType)
  type!: RoomType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;
}
