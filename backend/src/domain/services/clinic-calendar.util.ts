// This codebase stores appointment/schedule datetimes as "naive local wall-clock
// values labeled UTC" — e.g. a 15:00 Vietnam-time slot is built via
// `Date.UTC(y, m, d, 15, 0)` with no real timezone offset applied (see
// find-available-doctors.use-case.ts). Reading such a value back with
// getUTC*() getters therefore already yields the correct Vietnam wall-clock
// components directly.
//
// `Date.now()`/`new Date()`, however, is a real UTC instant. To compare it
// against those naive values (e.g. "is this slot in the past?", "is today the
// same calendar day as this appointment?"), it must first be shifted by the
// clinic's UTC+7 offset so its getUTC*() getters yield the same Vietnam
// wall-clock day/hour that the stored values represent.
const CLINIC_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Converts a real-UTC instant (e.g. `new Date()`, a Prisma `@default(now())`/
 * `checked_in_at` column) into its clinic-naive-UTC representation, so its
 * getUTC*() getters read as Vietnam wall-clock time — same shift
 * `nowAsClinicNaiveUtc()` applies to "now", generalized to any real-UTC Date.
 */
export function toClinicNaiveUtc(date: Date): Date {
  return new Date(date.getTime() + CLINIC_UTC_OFFSET_MS);
}

/** The current instant, shifted so its getUTC*() getters read as Vietnam wall-clock time. */
export function nowAsClinicNaiveUtc(): Date {
  return toClinicNaiveUtc(new Date());
}

/** Truncates a clinic-naive-UTC datetime to just its calendar date (00:00). */
export function toClinicDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Whether two clinic-naive-UTC datetimes fall on the same Vietnam calendar day. */
export function isSameClinicDay(a: Date, b: Date): boolean {
  return toClinicDateOnly(a).getTime() === toClinicDateOnly(b).getTime();
}

/**
 * Formats a clinic-naive-UTC datetime (e.g. `appointmentTime`) as
 * "HH:mm dd/MM/yyyy" Vietnam wall-clock time, for use in notification
 * bodies/printed documents. Deliberately uses getUTC*() getters instead of
 * `toLocaleString('vi-VN')` — the latter renders in the *server's* runtime
 * timezone, which silently shifts the displayed hour whenever the server
 * isn't running in Asia/Ho_Chi_Minh (e.g. a UTC cloud deployment).
 */
export function formatClinicDateTime(date: Date): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
}
