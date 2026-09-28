import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpsertVitalSignsDto {
  @IsOptional()
  @IsInt()
  @Min(40) @Max(300)
  systolicBp?: number;

  @IsOptional()
  @IsInt()
  @Min(20) @Max(200)
  diastolicBp?: number;

  @IsOptional()
  @IsInt()
  @Min(20) @Max(300)
  heartRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(30) @Max(45)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(50) @Max(100)
  spo2?: number;

  @IsOptional()
  @IsNumber()
  @Min(1) @Max(500)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(30) @Max(250)
  height?: number;
}
