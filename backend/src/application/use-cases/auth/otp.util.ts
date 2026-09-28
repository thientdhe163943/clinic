import * as crypto from 'crypto';

export const OTP_TTL_MINUTES = 5;

// Generates a 6-digit numeric OTP code, e.g. "042913".
export function generateOtpCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// Used by the guest-booking OTP flow (RequestGuestAppointmentOtpUseCase /
// ConfirmGuestAppointmentOtpUseCase), which has no User row to attach an
// OtpToken to yet (see OtpTokenRepository — userId is a required FK) and so
// carries the OTP inside a signed, short-lived JWT instead of the otp_tokens
// table. Only the hash — never the raw code — goes into that token, since
// the token itself round-trips through the client/browser.
export function hashOtpCode(otpCode: string): string {
  return crypto.createHash('sha256').update(otpCode).digest('hex');
}
