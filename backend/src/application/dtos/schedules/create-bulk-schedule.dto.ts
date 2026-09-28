import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ShiftType } from '../../../domain/enums/shift-type.enum';

export class CreateBulkScheduleRequestDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  roomId!: string;

  @IsNotEmpty()
  @IsEnum(ShiftType)
  shift!: ShiftType;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  fromDate!: Date;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  toDate!: Date;

  // 0 = Chủ nhật ... 6 = Thứ bảy (JS Date#getUTCDay()).
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[];

  @IsOptional()
  @IsString()
  note?: string;
}
