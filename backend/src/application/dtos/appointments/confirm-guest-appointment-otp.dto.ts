import { IsNotEmpty, IsString, Length } from 'class-validator';

// Step (b) of the guest-booking OTP flow — `otpToken` is the opaque JWT
// returned by POST /appointments/guest/otp (RequestGuestAppointmentOtpUseCase),
// carrying the booking payload + a hash of the OTP code; `otpCode` is what
// the guest actually typed in from the email.
export class ConfirmGuestAppointmentOtpDto {
  @IsNotEmpty()
  @IsString()
  otpToken!: string;

  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  otpCode!: string;
}
