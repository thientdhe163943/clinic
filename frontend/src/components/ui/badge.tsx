import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// Status colors (docs/design.md mục 5, 2026-08-20) — exact hex from spec
// via Tailwind arbitrary values, variant *names* unchanged so no call site
// (`<Badge variant="...">`) needs editing. `default` matches the current
// `--primary-fixed` token (blue-100); the other variants are semantic
// status colors independent of brand hue, unchanged across every token
// revision so far.
const variantClass: Record<BadgeVariant, string> = {
  default: 'border-[#bfdbfe] bg-[#dbeafe] text-[#1e3a8a]', // Confirmed/Checked-in (informational blue)
  success: 'border-[#83fc8e]/60 bg-[#d4f7db] text-[#00531a]', // Completed
  warning: 'border-[#9fdcef] bg-[#e0f4fc] text-[#004e5f]', // In-progress
  danger: 'border-[#ffb4a9] bg-[#ffdad6] text-[#93000a]', // Cancelled/error
  muted: 'border-[#cbd5e1] bg-[#e2e8f0] text-[#475569]', // Pending
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold',
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
}
