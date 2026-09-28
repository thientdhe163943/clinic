import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPasswordRequestDto {
  // Email-only — see ForgotPasswordRequestDto, same flow/same value re-sent.
  @IsEmail()
  username!: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  otpCode!: string;

  @IsNotEmpty()
  @IsString()
  newPassword!: string;

  @IsNotEmpty()
  @IsString()
  confirmPassword!: string;
}
