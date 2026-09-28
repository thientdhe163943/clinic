import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class ImportSupplyLineDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0123 })
  supplyId: string;

  // Positivity is enforced in ImportSuppliesUseCase via InvalidQuantityError
  // (MSG_ERR_0050), not here — Feature 28's "quantity > 0" is a reserved
  // domain-specific message code, not the generic VALIDATION_FAILED one a
  // class-validator decorator would produce.
  @Type(() => Number)
  @IsInt()
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: MSG.ERR_0125 })
  unitPrice: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}

export class ImportSuppliesDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0126 })
  supplierId: string;

  @IsArray()
  @ArrayMinSize(1, { message: MSG.ERR_0127 })
  @ValidateNested({ each: true })
  @Type(() => ImportSupplyLineDto)
  items: ImportSupplyLineDto[];
}
