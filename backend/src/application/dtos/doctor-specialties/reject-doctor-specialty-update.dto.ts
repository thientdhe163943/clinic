import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectDoctorSpecialtyUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
