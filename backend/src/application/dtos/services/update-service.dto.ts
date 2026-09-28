import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0111 })
  @MaxLength(50, { message: MSG.ERR_0112 })
  name?: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsEnum(ServiceType, { message: MSG.ERR_0113 })
  type?: ServiceType;

  // Only meaningful when the resulting type = CLS — required in that case,
  // forbidden when the resulting type = EXAMINATION (enforced in
  // UpdateServiceUseCase). Nullable so a CLS->EXAMINATION type change (or an
  // explicit correction) can clear a previously-set category.
  @IsOptional()
  @IsEnum(ClsRoomCategory, { message: MSG.ERR_0114 })
  clsCategory?: ClsRoomCategory | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: MSG.ERR_0110 })
  price?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
