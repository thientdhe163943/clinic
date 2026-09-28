import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxDate, MaxLength } from 'class-validator';
import { Gender } from '../../../domain/enums/gender.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import {
  FULL_NAME_MAX_LENGTH,
  ID_CARD_MESSAGE,
  ID_CARD_REGEX,
  PHONE_MESSAGE,
  PHONE_REGEX,
  stripWhitespace,
} from '../shared/identity-validation';

export class UpdatePatientRequestDto {
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @MaxDate(() => new Date(), { message: MSG.ERR_0099 })
  dateOfBirth?: Date;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;

  @Transform(({ value }) => stripWhitespace(value))
  @IsOptional()
  @IsString()
  @Matches(ID_CARD_REGEX, { message: ID_CARD_MESSAGE })
  idCard?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsBoolean()
  notificationConsent?: boolean;
}
