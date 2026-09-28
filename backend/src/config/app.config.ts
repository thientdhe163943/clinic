export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3001),
    apiPrefix: process.env.API_PREFIX ?? '/api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshTokenExpiresDays: Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS ?? 7),
  },
  aws: {
    region: process.env.AWS_REGION ?? 'ap-southeast-1',
    s3Bucket: process.env.S3_BUCKET,
    cloudFrontUrl: process.env.CLOUDFRONT_URL,
  },
  // Feature 83/86/87 (docs/features/sprint4/13_ai_chatbot.md) — free,
  // open-weight model via Groq's OpenAI-compatible chat completions API.
  ai: {
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
  },
  // Version-up 0.2 plan, item #7 "Chống spam đặt lịch" — tunable
  // anti-spam/anti-no-show thresholds for the appointment booking flow, kept
  // configurable per environment rather than hardcoded (docs/coding_style.md
  // mục 8).
  booking: {
    // POST /appointments/guest(+/otp,/confirm) — unauthenticated, IP-tracked.
    guestRateLimit: Number(process.env.BOOKING_GUEST_RATE_LIMIT ?? 5),
    guestRateLimitTtlMs: Number(process.env.BOOKING_GUEST_RATE_LIMIT_TTL_MS ?? 3_600_000),
    // POST /appointments booked by a logged-in PATIENT — user-tracked
    // (RECEPTIONIST bookings on the same endpoint are exempt, see
    // PatientBookingThrottlerGuard).
    patientRateLimit: Number(process.env.BOOKING_PATIENT_RATE_LIMIT ?? 10),
    patientRateLimitTtlMs: Number(process.env.BOOKING_PATIENT_RATE_LIMIT_TTL_MS ?? 3_600_000),
    // Max PENDING/CONFIRMED (future) appointments a single patient may hold
    // at once before new bookings are rejected.
    maxPendingAppointmentsPerPatient: Number(process.env.BOOKING_MAX_PENDING_APPOINTMENTS ?? 3),
    // A patient with >= this many NO_SHOW visits in the lookback window loses
    // the receptionist-booking auto-CONFIRMED fast-path (stays PENDING).
    noShowTrustThreshold: Number(process.env.BOOKING_NO_SHOW_TRUST_THRESHOLD ?? 2),
    noShowLookbackDays: Number(process.env.BOOKING_NO_SHOW_LOOKBACK_DAYS ?? 90),
  },
});
