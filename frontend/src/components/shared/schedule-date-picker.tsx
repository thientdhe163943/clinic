'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const WEEKDAY_HEADERS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// The 42-cell grid always shows a few days from the neighboring months —
// the parent needs this exact range (not just the calendar month) to fetch
// enough existing-schedule data to disable every visible day correctly.
export function getScheduleDatePickerGridRange(displayMonth: Date): { from: string; to: string } {
  const monthStart = startOfMonth(displayMonth);
  const grid = buildMonthGrid(monthStart);
  return { from: toDateOnlyString(grid[0]), to: toDateOnlyString(grid[grid.length - 1]) };
}

// Monday-start grid (matches admin/schedules/calendar/page.tsx's week view)
// — the leading/trailing cells from the neighboring months are rendered so
// every week row stays 7 columns, but they're not selectable.
function buildMonthGrid(monthStart: Date): Date[] {
  const firstWeekday = monthStart.getDay();
  const leadingDays = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - leadingDays);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

interface ScheduleDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  /** First selectable date (YYYY-MM-DD) — earlier dates are disabled. */
  minDate: string;
  /** Dates (YYYY-MM-DD) that already have a schedule and can't be picked again. */
  disabledDates: Set<string>;
  displayMonth: Date;
  onDisplayMonthChange: (date: Date) => void;
}

// A plain <input type="date"> can only set a min/max range — it can't gray
// out arbitrary individual dates, which is what's needed to keep an admin
// from re-picking a day the selected doctor/staff already has a schedule
// on. This renders a small month grid instead, so already-scheduled days
// (disabledDates, computed by the parent from that staff member's existing
// schedules) are visibly struck out and unclickable, same as past dates.
export function ScheduleDatePicker({
  value,
  onChange,
  minDate,
  disabledDates,
  displayMonth,
  onDisplayMonthChange,
}: ScheduleDatePickerProps) {
  const monthStart = startOfMonth(displayMonth);
  const days = buildMonthGrid(monthStart);

  return (
    <div className="w-full rounded-md border border-input bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tháng trước"
          onClick={() => onDisplayMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium text-foreground">
          Tháng {monthStart.getMonth() + 1}/{monthStart.getFullYear()}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Tháng sau"
          onClick={() => onDisplayMonthChange(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAY_HEADERS.map((label) => (
          <span key={label} className="py-1">{label}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dateStr = toDateOnlyString(day);
          const inCurrentMonth = day.getMonth() === monthStart.getMonth();
          const isPast = dateStr < minDate;
          const isAlreadyScheduled = disabledDates.has(dateStr);
          const isDisabled = isPast || isAlreadyScheduled;
          const isSelected = dateStr === value;

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isDisabled}
              onClick={() => onChange(dateStr)}
              title={isAlreadyScheduled ? 'Đã có lịch làm việc' : undefined}
              className={cn(
                'h-9 rounded-md text-sm transition-colors',
                !inCurrentMonth && 'text-muted-foreground/40',
                inCurrentMonth && !isDisabled && !isSelected && 'text-foreground hover:bg-secondary',
                isSelected && 'bg-primary text-primary-foreground font-semibold',
                isDisabled && inCurrentMonth && 'text-muted-foreground/50 line-through cursor-not-allowed',
                isDisabled && !inCurrentMonth && 'cursor-not-allowed',
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
