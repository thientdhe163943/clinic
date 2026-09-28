import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class CreateSupplyDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0119 })
  @MaxLength(150, { message: MSG.ERR_0120 })
  name: string;

  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0121 })
  categoryId: string;

  @IsEnum(MeasurementUnit, { message: MSG.ERR_0109 })
  unit: MeasurementUnit;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0, { message: MSG.ERR_0122 })
  minStockLevel: number;
}
