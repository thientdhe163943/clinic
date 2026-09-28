'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface RowActionMenuItem {
  label: string;
  icon?: LucideIcon;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}

// Generic "⋮" overflow menu for a table row's secondary actions — same
// click-to-toggle / click-outside-to-close pattern as user-menu.tsx,
// generalized so any row (appointments, patients, ...) can move
// low-priority actions out of the main action cell instead of lining up
// same-weight icon buttons.
export function RowActionMenu({ items }: { items: RowActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Thao tác khác"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 origin-top-right rounded-lg border border-border bg-white p-1.5 shadow-lg">
          {items.map((item) => {
            const Icon = item.icon;
            const className = cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
              item.danger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-secondary',
            );
            if (item.href) {
              return (
                <Link key={item.label} href={item.href} onClick={() => setOpen(false)} className={className}>
                  {Icon && <Icon className="h-4 w-4" />}
                  {item.label}
                </Link>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick?.();
                }}
                className={className}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {item.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
