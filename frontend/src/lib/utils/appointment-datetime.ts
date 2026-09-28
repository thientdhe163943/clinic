// appointment.appointmentTime is stored as a naive Vietnam wall-clock value
// labeled UTC (see backend find-available-doctors.use-case.ts / clinic-calendar.util.ts)
// — e.g. a 15:00 VN-local slot is literally `...T15:00:00.000Z`, NOT a real
// UTC instant. Formatting it with real timezone-aware methods like
// `toLocaleString()`/`toLocaleTimeString()` converts it to the *browser's*
// local timezone, shifting the displayed hour away from the intended one
// (e.g. showing 22:00 instead of 15:00 for a browser set to UTC+7, since
// 15:00 "UTC" + 7h = 22:00). Read the UTC-labeled components directly
// instead, the same way the backend does.
function toDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

export function formatAppointmentDateTime(value: string | Date): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return String(value);
  return `${formatAppointmentTimeOnly(d)} ${formatAppointmentDateOnly(d)}`;
}

export function formatAppointmentTimeOnly(value: string | Date): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return String(value);
  const hour = String(d.getUTCHours()).padStart(2, '0');
  const minute = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function formatAppointmentDateOnly(value: string | Date): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return String(value);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** "Thứ 2, ngày 13/07/2026 · 15:00" — full-style equivalent of formatAppointmentDateTime. */
export function formatAppointmentDateTimeFull(value: string | Date): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return String(value);
  const weekday = WEEKDAY_LABELS[d.getUTCDay()];
  return `${weekday}, ngày ${formatAppointmentDateOnly(d)} · ${formatAppointmentTimeOnly(d)}`;
}

const CLINIC_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * The current instant, shifted so it can be compared (via getTime()) against
 * an appointmentTime-style naive-UTC value on equal footing — e.g.
 * `nowAsClinicNaiveUtcMs() - new Date(appointmentTime).getTime()`. Without
 * this shift, comparisons against the real `Date.now()` are off by exactly
 * the clinic's UTC+7 offset.
 */
export function nowAsClinicNaiveUtcMs(): number {
  return Date.now() + CLINIC_UTC_OFFSET_MS;
}

/**
 * Converts an `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", no
 * timezone) back into the naive-UTC-labeled ISO string appointmentTime
 * expects. `new Date(value).toISOString()` would be wrong here — it
 * interprets the input as the *browser's* local time and converts it to a
 * real UTC instant, shifting the hour away from the Vietnam wall-clock value
 * the user actually typed.
 */
export function parseDateTimeLocalAsAppointmentTime(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = (timePart ?? '00:00').split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString();
}
