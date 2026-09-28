export const APPOINTMENT_SLOT_MINUTES = 20;

// A Confirmed appointment more than this many minutes past its own
// appointment_time without being checked in no longer counts as occupying
// its slot for conflict checks (Feature 59 business rules, added 2026-07-08).
export const CONFIRMED_STALE_MINUTES = 60;
