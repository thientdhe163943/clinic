import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { MSG } from '../../../domain/value-objects/message-code.vo';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: MSG.ERR_0115 })
  @MaxLength(150, { message: MSG.ERR_0116 })
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, { message: MSG.ERR_0117 })
  phone?: string;

  @IsOptional()
  @IsEmail({}, { message: MSG.ERR_0118 })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
