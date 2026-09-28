export enum OtpPurpose {
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  // Despite the name (kept as-is to avoid a value-rename across any existing
  // data), this purpose is now used for guest-booking email verification
  // (version-up 0.2 plan item #7, RequestGuestAppointmentOtpUseCase /
  // ConfirmGuestAppointmentOtpUseCase) rather than actual phone verification
  // — SMS delivery was removed from this codebase (see
  // forgot-password.use-case.ts), so every OTP purpose is email-only today.
  VERIFY_PHONE = 'VERIFY_PHONE',
}
