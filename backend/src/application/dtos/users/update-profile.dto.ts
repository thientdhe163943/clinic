import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { FULL_NAME_MAX_LENGTH, PHONE_MESSAGE, PHONE_REGEX } from '../shared/identity-validation';

export class UpdateProfileRequestDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;
}
