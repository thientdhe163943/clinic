import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class CreateSpecialtyDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0100 })
  @MaxLength(100, { message: MSG.ERR_0101 })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
