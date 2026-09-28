import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpRequestDto {
  // Email-only — see ForgotPasswordRequestDto, same flow/same value re-sent.
  @IsEmail()
  username!: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  otpCode!: string;
}
