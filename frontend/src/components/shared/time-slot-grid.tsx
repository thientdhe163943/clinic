'use client';

import { cn } from '@/lib/utils/cn';

interface TimeSlotGridProps {
  value: string;
  onChange: (time: string) => void;
  options: string[];
  /** Times that can't be picked (rendered dimmed/struck-through) — e.g. already past for today. */
  disabledOptions?: Set<string>;
  placeholder?: string;
}

// Sáng/Chiều grouped grid of time-slot buttons — same prop contract as
// TimeWheelPicker, but rendered inline (no modal) as pill buttons split by
// morning/afternoon, matching the reference booking mockup.
export function TimeSlotGrid({
  value,
  onChange,
  options,
  disabledOptions,
  placeholder = 'Chưa có khung giờ khả dụng',
}: TimeSlotGridProps) {
  const morning = options.filter((time) => time < '12:00');
  const afternoon = options.filter((time) => time >= '12:00');

  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">{placeholder}</p>;
  }

  function renderGroup(label: string, times: string[]) {
    if (times.length === 0) return null;
    return (
      <div className="space-y-2" key={label}>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex flex-wrap gap-2">
          {times.map((time) => {
            const isDisabled = Boolean(disabledOptions?.has(time));
            const isSelected = value === time;
            return (
              <button
                key={time}
                type="button"
                disabled={isDisabled}
                onClick={() => onChange(time)}
                className={cn(
                  'h-9 rounded-md border px-3 text-sm font-medium transition-colors',
                  isDisabled
                    ? 'cursor-not-allowed border-border bg-muted text-muted-foreground/50 line-through'
                    : isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-white text-foreground hover:border-primary hover:text-primary',
                )}
              >
                {time}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderGroup('Sáng', morning)}
      {renderGroup('Chiều', afternoon)}
    </div>
  );
}
