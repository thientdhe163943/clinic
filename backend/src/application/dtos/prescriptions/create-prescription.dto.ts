import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CreatePrescriptionItemDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsString()
  dosage: string;

  @IsString()
  frequency: string;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsString()
  instruction?: string;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  visitId: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}
