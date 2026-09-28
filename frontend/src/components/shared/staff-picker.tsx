'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useStaffOptions } from '@/hooks/use-staff-options';
import { cn } from '@/lib/utils/cn';
import type { UserRole } from '@/types/auth';

const roleLabels: Record<string, string> = {
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  LAB_TECH: 'KTV',
  RECEPTIONIST: 'Lễ tân',
};

function normalize(value: string) {
  return value.toLowerCase();
}

interface StaffPickerProps {
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  /** When true, shows a "Tất cả nhân sự" option that clears the selection — for filter use, not create forms. */
  allowClear?: boolean;
  roleFilter?: UserRole[];
  /** Hides specific user ids from the option list — e.g. the doctor already on the shift being reassigned. */
  excludeIds?: string[];
  required?: boolean;
  disabled?: boolean;
}

// Plain <select> with 100+ staff crammed into it is unusable (no search,
// just a giant native list) — this is a searchable combobox instead: type to
// filter by name/role, click a result to pick. Shared across every screen
// that lets Admin choose 1 staff member for scheduling (create/bulk/leave)
// or filter by staff (list), so the fix applies everywhere the same
// unusable <select> used to be, not just the 1 screen that was reported.
export function StaffPicker({
  value,
  onChange,
  placeholder = 'Tìm theo tên hoặc vai trò...',
  allowClear = false,
  roleFilter,
  excludeIds,
  required,
  disabled,
}: StaffPickerProps) {
  const staffOptions = useStaffOptions();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scopedOptions = useMemo(() => {
    let options = roleFilter ? staffOptions.filter((user) => roleFilter.includes(user.role)) : staffOptions;
    if (excludeIds?.length) options = options.filter((user) => !excludeIds.includes(user.id));
    return options;
  }, [staffOptions, roleFilter, excludeIds]);

  const selected = scopedOptions.find((user) => user.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return scopedOptions;
    return scopedOptions.filter(
      (user) =>
        normalize(user.fullName).includes(q) ||
        normalize(user.email ?? '').includes(q) ||
        normalize(roleLabels[user.role] ?? user.role).includes(q),
    );
  }, [scopedOptions, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function pick(userId: string) {
    onChange(userId);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      {selected && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex h-auto min-h-10 w-full items-center justify-between rounded-md border border-input bg-white px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex min-w-0 flex-col items-start">
              <span className="truncate font-medium text-foreground">{selected.fullName}</span>
              <span className="truncate text-xs text-muted-foreground">{selected.email}</span>
            </span>
            <Badge variant="muted">{roleLabels[selected.role] ?? selected.role}</Badge>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {allowClear && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  clear();
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            disabled={disabled}
            required={required && !value}
            className="h-10 w-full rounded-md border border-input bg-white pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
          />
        </div>
      )}

      {open && !disabled ? (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-white p-1 shadow-md">
          {allowClear && (
            <button
              type="button"
              onClick={clear}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              Tất cả nhân sự
            </button>
          )}
          {staffOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Đang tải danh sách nhân sự...</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy nhân sự phù hợp.</p>
          ) : (
            filtered.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => pick(user.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                  user.id === value && 'bg-primary/5',
                )}
              >
                <span className="flex min-w-0 flex-col items-start">
                  <span className="truncate font-medium text-foreground">{user.fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                <Badge variant="muted">{roleLabels[user.role] ?? user.role}</Badge>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
