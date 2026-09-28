import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import {
  FULL_NAME_MAX_LENGTH,
  ID_CARD_MESSAGE,
  ID_CARD_REGEX,
  PHONE_MESSAGE,
  PHONE_REGEX,
  stripWhitespace,
} from '../shared/identity-validation';

const ALLOWED_ROLES = [UserRole.RECEPTIONIST, UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: MSG.ERR_0118 })
  email?: string;

  @IsOptional()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone?: string;

  @IsOptional()
  @IsEnum(ALLOWED_ROLES, { message: MSG.ERR_0132 })
  role?: UserRole;

  @Transform(({ value }) => stripWhitespace(value))
  @IsOptional()
  @IsString()
  @Matches(ID_CARD_REGEX, { message: ID_CARD_MESSAGE })
  idCard?: string;

  // Department grouping for non-doctor staff, for room-picker filtering
  // only. `undefined` = leave unchanged, `null` = explicitly clear back to
  // unset.
  @IsOptional()
  @IsString()
  specialtyId?: string | null;
}
