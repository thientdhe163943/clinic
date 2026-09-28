import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class CreateMedicineDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0103 })
  @MaxLength(150, { message: MSG.ERR_0104 })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0105 })
  @MaxLength(200, { message: MSG.ERR_0106 })
  activeIngredient!: string;

  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0107 })
  @MaxLength(50, { message: MSG.ERR_0108 })
  dosageForm!: string;

  @IsEnum(MeasurementUnit, { message: MSG.ERR_0109 })
  unit!: MeasurementUnit;

  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: MSG.ERR_0110 })
  price!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  contraindications?: string;
}
