import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { SeverityLevel } from '@prisma/client';

export class MedicalRecordAllergyRequestDto {
  @IsString()
  allergen!: string;

  @IsEnum(SeverityLevel)
  severity!: SeverityLevel;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateMedicalRecordRequestDto {
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @IsOptional()
  @IsString()
  clinicalNote?: string;

  @IsOptional()
  @IsString()
  diagnosisSummary?: string;

  @IsOptional()
  @IsString()
  treatmentSummary?: string;

  @IsOptional()
  @IsString()
  followUpNote?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicalRecordAllergyRequestDto)
  allergies?: MedicalRecordAllergyRequestDto[];
}
