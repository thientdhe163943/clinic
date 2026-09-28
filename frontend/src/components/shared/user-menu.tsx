'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronDown, ClipboardList, KeyRound, LogOut, User } from 'lucide-react';
import Link from 'next/link';

interface UserMenuProps {
  fullName?: string;
  onLogout: () => void;
}

export function UserMenu({ fullName, onLogout }: UserMenuProps) {
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

  const initial = fullName?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate xl:inline">{fullName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg border border-border bg-white p-1.5 shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
            <p className="text-xs text-muted-foreground">Tài khoản bệnh nhân</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <User className="h-4 w-4 text-primary" />
            Hồ sơ
          </Link>
          <Link
            href="/my-appointments"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <CalendarClock className="h-4 w-4 text-primary" />
            Lịch hẹn của tôi
          </Link>
          <Link
            href="/my-medical-record"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <ClipboardList className="h-4 w-4 text-primary" />
            Hồ sơ bệnh án
          </Link>
          <Link
            href="/change-password"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-secondary"
          >
            <KeyRound className="h-4 w-4 text-primary" />
            Đổi mật khẩu
          </Link>
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}
