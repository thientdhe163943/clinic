import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

// Version-up 0.2 Phase 2 #9 tình huống B — ADMIN marks a doctor absent for a
// whole shift and swaps in a substitute (ReassignScheduleDoctorUseCase).
export class ReassignScheduleDoctorRequestDto {
  @IsNotEmpty()
  @IsString()
  substituteDoctorId!: string;

  // Matches work_schedules.absent_note VARCHAR(255).
  @IsNotEmpty()
  @IsString()
  @MaxLength(255, { message: MSG.ERR_0142 })
  reason!: string;
}
