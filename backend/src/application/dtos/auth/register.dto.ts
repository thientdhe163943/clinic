import { Transform } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Gender } from '../../../domain/enums/gender.enum';
import {
  FULL_NAME_MAX_LENGTH,
  ID_CARD_MESSAGE,
  ID_CARD_REGEX,
  PHONE_MESSAGE,
  PHONE_REGEX,
  stripWhitespace,
} from '../shared/identity-validation';

export class RegisterRequestDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName!: string;

  // Mandatory specifically for self-service register (2026-08-07 decision)
  // — unlike guest-booking/create-patient, which stayed optional (phone +
  // idCard already work as login identifiers on their own).
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @Transform(({ value }) => stripWhitespace(value))
  @IsNotEmpty()
  @IsString()
  @Matches(ID_CARD_REGEX, { message: ID_CARD_MESSAGE })
  idCard!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsNotEmpty()
  @IsString()
  confirmPassword!: string;
}
