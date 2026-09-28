import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ShiftType } from '../../../domain/enums/shift-type.enum';

export class CreateScheduleRequestDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  roomId!: string;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  workDate!: Date;

  @IsNotEmpty()
  @IsEnum(ShiftType)
  shift!: ShiftType;

  @IsOptional()
  @IsString()
  note?: string;
}
