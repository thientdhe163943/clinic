import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClsOrderDto {
  @IsString()
  @IsNotEmpty()
  visitId: string;

  @IsString()
  @IsNotEmpty()
  clsRoomId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
