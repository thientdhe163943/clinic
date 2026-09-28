import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateExaminationResultDto {
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @IsOptional()
  @IsString()
  clinicalNote?: string | null;

  @IsOptional()
  @IsString()
  treatmentResult?: string | null;

  @IsOptional()
  @IsDateString()
  followUpDate?: string | null;
}
