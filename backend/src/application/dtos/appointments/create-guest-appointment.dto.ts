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

// Combines RegisterRequestDto's account-creation fields with
// CreateAppointmentRequestDto's booking fields — used by the unauthenticated
// "book + create account in one step" guest flow (see
// CreateGuestAppointmentUseCase). Field-for-field validation is copied from
// both of those DTOs rather than re-derived. No password field — the guest
// doesn't choose one; the account starts on DEFAULT_PATIENT_PASSWORD with
// mustChangePassword: true, same as a receptionist-created walk-in patient.
export class CreateGuestAppointmentRequestDto {
  // ─── Account fields (mirrors RegisterRequestDto) ──────────────────────
  @IsNotEmpty()
  @IsString()
  @MaxLength(FULL_NAME_MAX_LENGTH)
  fullName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

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

  // ─── Booking fields (mirrors CreateAppointmentRequestDto) ─────────────
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
