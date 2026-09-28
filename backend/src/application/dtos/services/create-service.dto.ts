import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0111 })
  @MaxLength(50, { message: MSG.ERR_0112 })
  name: string;

  @IsOptional()
  @IsString()
  specialtyId?: string;

  @IsOptional()
  @IsEnum(ServiceType, { message: MSG.ERR_0113 })
  type?: ServiceType;

  // Only meaningful when type = CLS — required for CLS services, forbidden
  // for EXAMINATION services (enforced in CreateServiceUseCase).
  @IsOptional()
  @IsEnum(ClsRoomCategory, { message: MSG.ERR_0114 })
  clsCategory?: ClsRoomCategory;

  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: MSG.ERR_0110 })
  price: number;

  @IsOptional()
  @IsString()
  description?: string;
}
