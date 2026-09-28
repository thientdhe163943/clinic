import { Transform, Type } from 'class-transformer';
import { IsDate, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Gender } from '../../../domain/enums/gender.enum';
import {
  FULL_NAME_MAX_LENGTH,
  ID_CARD_MESSAGE,
  ID_CARD_REGEX,
  PHONE_MESSAGE,
  PHONE_REGEX,
  stripWhitespace,
} from '../shared/identity-validation';

// Step (a) of the version-up 0.2 item #7 "xác minh email trước khi hoàn tất
// đặt lịch khách vãng lai" two-step guest-booking flow — same fields as
// CreateGuestAppointmentRequestDto (field-for-field copy, same rationale:
// see that DTO's own comment), except `email` is required here (not
// optional): OTP delivery is email-only in this codebase (SMS was removed),
// so this new flow has nothing to verify against without one. The legacy
// single-step POST /appointments/guest is untouched and still accepts a
// guest with no email at all.
export class RequestGuestAppointmentOtpDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Transform(({ value }) => stripWhitespace(value))
  @IsOptional()
  @IsString()
  @Matches(ID_CARD_REGEX, { message: ID_CARD_MESSAGE })
  idCard?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @Type(() => Date)
  @IsDate()
  appointmentTime!: Date;

  @IsOptional()
  @IsString()
  note?: string;
}
