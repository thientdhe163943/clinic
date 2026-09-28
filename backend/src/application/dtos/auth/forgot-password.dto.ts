import { IsEmail } from 'class-validator';

export class ForgotPasswordRequestDto {
  // Email-only (2026-08-07) — this used to also accept a phone number, but
  // OTP delivery is email-only (SMS was removed), so looking an account up
  // by phone was always a dead end if that account had no email on file
  // (also, email is no longer mandatory at account creation, making that
  // dead end more likely). Keeping the field named `username` rather than
  // renaming to `email` avoids unrelated churn across the 3 DTOs/hook/page
  // that share this field for the whole forgot-password flow.
  @IsEmail()
  username!: string;
}
