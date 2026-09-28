'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 5;
const PADDING_ROWS = Math.floor(VISIBLE_ROWS / 2);

interface TimeWheelPickerProps {
  value: string;
  onChange: (time: string) => void;
  options: string[];
  /** Times that can't be picked (rendered dimmed/struck-through) — e.g. already past for today. */
  disabledOptions?: Set<string>;
  placeholder?: string;
}

// iOS-style vertical scroll/swipe wheel — tap the field to open a sheet with
// a snap-scrolling column of times instead of a flat list or native picker.
export function TimeWheelPicker({ value, onChange, options, disabledOptions, placeholder = 'Chọn giờ' }: TimeWheelPickerProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(value || options[0] || '');
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) return;
    const start = value && options.includes(value) ? value : options[0] || '';
    setPending(start);
    const index = Math.max(options.indexOf(start), 0);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: index * ROW_HEIGHT, behavior: 'auto' });
    });
    // Only re-sync when the sheet opens, not on every `value`/`options` change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function centerIndexFromScroll(): number {
    const el = listRef.current;
    if (!el) return 0;
    return Math.min(Math.max(Math.round(el.scrollTop / ROW_HEIGHT), 0), options.length - 1);
  }

  function handleScroll() {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setPending(options[centerIndexFromScroll()] ?? '');
    }, 80);
  }

  function scrollToIndex(index: number) {
    listRef.current?.scrollTo({ top: index * ROW_HEIGHT, behavior: 'smooth' });
  }

  function confirm() {
    if (pending && !disabledOptions?.has(pending)) {
      onChange(pending);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring/20"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || placeholder}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Chọn giờ khám" className="max-w-xs">
        <div className="relative" style={{ height: ROW_HEIGHT * VISIBLE_ROWS }}>
          {/* Center-row highlight band, purely visual, sits above the list */}
          <div
            className="pointer-events-none absolute left-0 right-0 z-10 border-y border-primary/40 bg-primary/5"
            style={{ top: PADDING_ROWS * ROW_HEIGHT, height: ROW_HEIGHT }}
          />
          <div
            ref={listRef}
            onScroll={handleScroll}
            className="h-full snap-y snap-mandatory overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ paddingTop: PADDING_ROWS * ROW_HEIGHT, paddingBottom: PADDING_ROWS * ROW_HEIGHT }}
          >
            {options.map((time, index) => {
              const isDisabled = Boolean(disabledOptions?.has(time));
              const isPending = pending === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    if (isDisabled) return;
                    setPending(time);
                    scrollToIndex(index);
                  }}
                  className={cn(
                    'flex w-full snap-center items-center justify-center text-base transition-colors',
                    isDisabled
                      ? 'cursor-not-allowed text-muted-foreground/50 line-through'
                      : isPending
                        ? 'font-semibold text-primary'
                        : 'text-foreground hover:text-primary',
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          className="mt-4 w-full"
          onClick={confirm}
          disabled={!pending || Boolean(disabledOptions?.has(pending))}
        >
          Xác nhận {pending}
        </Button>
      </Modal>
    </>
  );
}
