import { IsOptional, IsString } from 'class-validator';

export class EditClsOrderDto {
  @IsOptional()
  @IsString()
  clsRoomId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsOptional()
  @IsString()
  note?: string | null;
}
