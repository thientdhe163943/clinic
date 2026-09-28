'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { todayDateString } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';

const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

interface ParsedDate {
  year: number;
  month: number; // 0-11
  day: number;
}

function parseDateString(value: string): ParsedDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function toDateString(year: number, month: number, day: number): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function formatDisplayDate(value: string): string {
  const parsed = parseDateString(value);
  if (!parsed) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(parsed.day)}/${pad(parsed.month + 1)}/${parsed.year}`;
}

interface AppointmentDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  /** "YYYY-MM-DD" — days before this are dimmed/unclickable. */
  min?: string;
  /** "YYYY-MM-DD" strings that must render disabled/unclickable. */
  disabledDates?: Set<string>;
  placeholder?: string;
}

// Calendar-grid date picker — tap the field to open a Modal with a
// prev/next-navigable month grid, replacing the native <input type="date">.
// Follows the same open/close Modal pattern as TimeWheelPicker in this same
// folder for visual/interaction consistency.
export function AppointmentDatePicker({
  value,
  onChange,
  min,
  disabledDates,
  placeholder = 'Chọn ngày khám',
}: AppointmentDatePickerProps) {
  const [open, setOpen] = useState(false);

  const parsedValue = useMemo(() => parseDateString(value), [value]);
  const parsedMin = useMemo(() => (min ? parseDateString(min) : null), [min]);
  const fallbackView = useMemo(() => parseDateString(todayDateString())!, []);

  const [viewYear, setViewYear] = useState(() => (parsedValue ?? parsedMin ?? fallbackView).year);
  const [viewMonth, setViewMonth] = useState(() => (parsedValue ?? parsedMin ?? fallbackView).month);

  useEffect(() => {
    if (!open) return;
    const start = parsedValue ?? parsedMin ?? fallbackView;
    setViewYear(start.year);
    setViewMonth(start.month);
    // Only re-sync the visible month when the sheet opens, not on every
    // `value`/`min` change — same rationale as TimeWheelPicker's `pending`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function goToPrevMonth() {
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goToNextMonth() {
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const isPrevDisabled = parsedMin
    ? viewYear < parsedMin.year || (viewYear === parsedMin.year && viewMonth <= parsedMin.month)
    : false;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // JS getDay(): 0=Sun..6=Sat — shift so Monday is column 0 to match the T2..CN header.
  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const today = fallbackView;

  function isDisabledDay(day: number): boolean {
    const dateStr = toDateString(viewYear, viewMonth, day);
    if (min && dateStr < min) return true;
    return Boolean(disabledDates?.has(dateStr));
  }

  function handleSelectDay(day: number) {
    if (isDisabledDay(day)) return;
    onChange(toDateString(viewYear, viewMonth, day));
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Chọn ngày khám" className="max-w-sm">
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={goToPrevMonth}
            disabled={isPrevDisabled}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-sm font-semibold text-foreground">
            Tháng {viewMonth + 1} năm {viewYear}
          </p>
          <button
            type="button"
            onClick={goToNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="py-1">
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null) return <div key={`blank-${index}`} />;
            const dateStr = toDateString(viewYear, viewMonth, day);
            const isDisabled = isDisabledDay(day);
            const isSelected = value === dateStr;
            const isToday = today.year === viewYear && today.month === viewMonth && today.day === day;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={isDisabled}
                onClick={() => handleSelectDay(day)}
                className={cn(
                  'flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors',
                  isDisabled
                    ? 'cursor-not-allowed text-muted-foreground/50'
                    : isSelected
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : isToday
                        ? 'font-semibold text-primary ring-1 ring-inset ring-primary/40 hover:bg-muted'
                        : 'text-foreground hover:bg-muted',
                )}
              >
                {day}
              </button>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
