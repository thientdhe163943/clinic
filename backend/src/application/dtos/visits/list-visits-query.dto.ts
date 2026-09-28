import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { ShiftType } from '../../../domain/enums/shift-type.enum';

export class ListVisitsQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(VisitStatus)
  status?: VisitStatus;

  // Nurse-only: view a specific doctor's queue instead of every doctor's
  // (nurses aren't doctors themselves, so they have no "own" queue to scope
  // to). Ignored for DOCTOR callers, who are always scoped to themselves.
  @IsOptional()
  @IsString()
  doctorId?: string;

  // Explicitly view a given shift's queue instead of whichever shift is
  // covering the current time — lets the FE's Ca (shift) selector show
  // Sáng/Chiều/Cả ngày regardless of when the request happens to fire.
  @IsOptional()
  @IsEnum(ShiftType)
  shift?: ShiftType;
}
