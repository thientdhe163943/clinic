import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class CreateSupplyCategoryDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0130 })
  @MaxLength(100, { message: MSG.ERR_0131 })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
