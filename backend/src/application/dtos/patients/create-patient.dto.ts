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

export class CreatePatientRequestDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName!: string;

  // Optional (2026-08-07) — phone + idCard (both mandatory below) already
  // work as login identifiers on their own (see LoginUseCase), so email is
  // no longer required to create a usable patient account.
  @IsOptional()
  @IsEmail()
  email?: string;

  // `() => new Date()` (not a fixed `new Date()`) — a plain Date literal is
  // evaluated once at class-decoration time (module load), which would
  // freeze "today" to whenever the server process started and reject any
  // genuinely-past date entered after that on a long-running deployment.
  @Type(() => Date)
  @IsDate()
  @MaxDate(() => new Date(), { message: MSG.ERR_0099 })
  dateOfBirth!: Date;

  @IsEnum(Gender)
  gender!: Gender;

  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  // Mandatory (2026-07-19) — CCCD/CMND, like email and phone, is always
  // required and works as a login identifier in its own right (LoginUseCase
  // accepts any of the three).
  @Transform(({ value }) => stripWhitespace(value))
  @IsNotEmpty()
  @IsString()
  @Matches(ID_CARD_REGEX, { message: ID_CARD_MESSAGE })
  idCard!: string;

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
