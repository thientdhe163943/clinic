import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateExaminationResultDto {
  @IsString()
  diagnosis: string;

  @IsOptional()
  @IsString()
  clinicalNote?: string;

  @IsOptional()
  @IsString()
  treatmentResult?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}
