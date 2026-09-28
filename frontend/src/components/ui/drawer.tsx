'use client';

import { useEffect, useRef, type ReactNode, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from './button';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

// Slide-over panel from the right — same overlay/Escape/backdrop-click-to-
// close behavior as Dialog, but anchored to the edge and full-height for
// "quick look at one row without leaving the list" use cases (receptionist
// appointment detail).
export function Drawer({ open, onClose, title, description, children, className }: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const mouseDownTarget = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm"
      onMouseDown={(e: MouseEvent) => { mouseDownTarget.current = e.target; }}
      onClick={(e: MouseEvent) => {
        if (e.target === overlayRef.current && mouseDownTarget.current === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          'relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-card p-6 shadow-modal',
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="drawer-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng">
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
