// Clinic hours 07:00-17:30 in 20-minute steps (must match the backend's
// APPOINTMENT_SLOT_MINUTES, which rejects any submitted time off this grid)
// — shared by every screen that needs a plain list of pickable appointment
// times (the doctor-less "Đặt lịch nhanh" flow, and the receptionist's
// reschedule field), so the clinic's operating-hours assumption lives in one
// place.
const SLOT_MINUTES = 20;
const START_HOUR = 7;
const END_TIME = '17:30';

// 12:00-13:00 lunch break — mirrors the backend's SHIFT_HOURS gap between
// MORNING.endHour (12) and AFTERNOON.startHour (13), see isWithinLunchBreak()
// in prisma-work-schedule.repository.ts. The doctor-less flow has no shift
// to bound it, so these options must exclude the gap themselves rather than
// relying on the backend to reject it after the fact.
const LUNCH_BREAK_START = '12:00';
const LUNCH_BREAK_END = '13:00';

export function generateClinicTimeOptions(): string[] {
  const options: string[] = [];
  for (let minutes = START_HOUR * 60; ; minutes += SLOT_MINUTES) {
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    if (time > END_TIME) break;
    if (time >= LUNCH_BREAK_START && time < LUNCH_BREAK_END) continue;
    options.push(time);
  }
  return options;
}

// Shift start/endHour (see backend SHIFT_HOURS) can be fractional — 17.5
// means 17:30 — so any UI showing a shift's hours must format through this
// instead of a raw `${hour}:00` template, which would render "17.5:00".
export function formatShiftHour(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
