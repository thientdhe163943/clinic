// Today's date as YYYY-MM-DD in the browser's own local timezone (not UTC) —
// for `min` on a plain <input type="date"> (expiry dates, work schedule
// dates, appointment reschedule dates, ...), so it lines up with the
// calendar day the user actually sees, not a UTC day that can be off by one
// near midnight.
export function todayDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
