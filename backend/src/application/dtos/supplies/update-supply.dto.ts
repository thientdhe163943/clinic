import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

// currentStock is intentionally not settable here (Feature 24: "chỉnh sửa
// thông tin (trừ tồn kho)") — it only ever changes via import/distribute/
// return transactions.
export class UpdateSupplyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0119 })
  @MaxLength(150, { message: MSG.ERR_0120 })
  name?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(MeasurementUnit, { message: MSG.ERR_0109 })
  unit?: MeasurementUnit;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0, { message: MSG.ERR_0122 })
  minStockLevel?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
