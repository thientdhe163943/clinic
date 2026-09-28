// Feature 15 business rules (added 2026-07-07/2026-07-14).

// Within this many minutes of lateness past appointment_time, a checked-in
// patient keeps their original appointment-time slot in the queue. Beyond
// it, effective_queue_time falls back to their actual check-in time.
export const CHECK_IN_GRACE_PERIOD_MINUTES = 15;

// A Called visit that has been called this many times without the patient
// showing up is automatically marked NoShow (Feature 16 A1).
export const NO_SHOW_CALL_THRESHOLD = 3;
