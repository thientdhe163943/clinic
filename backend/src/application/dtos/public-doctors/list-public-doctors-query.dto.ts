import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListPublicDoctorsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  // When given, only doctors with at least one bookable slot on this date
  // are returned (Phase 0 of the 0.2 version-up plan, item #1 booking flow
  // support) — reuses DoctorSlotService, the same slot-exclusion logic as
  // FindAvailableDoctorsUseCase.
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  specialtyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  degree?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(80)
  minYearsExperience?: number;
}
