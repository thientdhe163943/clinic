'use client';

import { useEffect } from 'react';
import { ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import type { SpecialtyOption } from '@/types/doctor-specialties';

export interface NavGroup {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
}

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  groups: NavGroup[];
  specialties: SpecialtyOption[];
}

export function MobileNavDrawer({ open, onClose, groups, specialties }: MobileNavDrawerProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-[85vw] max-w-sm flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-foreground">Menu</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng menu"
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {groups.map((group) => (
            <div key={group.label} className="border-b border-border/60 pb-2 last:border-none">
              {group.href ? (
                <Link
                  href={group.href}
                  onClick={onClose}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
                >
                  {group.label}
                </Link>
              ) : (
                <p className="px-2 py-2.5 text-sm font-semibold text-foreground">{group.label}</p>
              )}
              {group.children && (
                <div className="ml-2 space-y-0.5 border-l border-border pl-3">
                  {group.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onClose}
                      className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {specialties.length > 0 && (
            <div className="pb-2">
              <p className="px-2 py-2.5 text-sm font-semibold text-foreground">Chuyên khoa</p>
              <div className="ml-2 space-y-0.5 border-l border-border pl-3">
                {specialties.slice(0, 8).map((specialty) => (
                  <Link
                    key={specialty.id}
                    href={`/clinic/departments/${specialty.id}`}
                    onClick={onClose}
                    className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                    {specialty.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}
