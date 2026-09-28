import { Gender } from '../../../domain/enums/gender.enum';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';

// Discriminator embedded in the JWT payload signed by
// RequestGuestAppointmentOtpUseCase and read back by
// ConfirmGuestAppointmentOtpUseCase — this app's JwtStrategy only ever reads
// `sub`/`email`/`role` off a verified token (see jwt.strategy.ts), so this
// `typ` field is purely defense-in-depth: it stops a token minted for this
// purpose from being mistaken for something else if `jwtService.verify()` is
// ever called on it from a different code path, and vice versa.
export const GUEST_BOOKING_OTP_JWT_TYPE = 'guest_appointment_otp' as const;

export interface GuestBookingOtpPayload {
  typ: typeof GUEST_BOOKING_OTP_JWT_TYPE;
  purpose: OtpPurpose;
  /** sha256 hex digest of the OTP code — never the raw code, see otp.util.ts. */
  otpHash: string;
  booking: {
    fullName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender?: Gender;
    idCard?: string;
    doctorId?: string;
    serviceId?: string;
    /** ISO string — CreateGuestAppointmentInput expects a real Date, see ConfirmGuestAppointmentOtpUseCase. */
    appointmentTime: string;
    note?: string;
  };
}
