import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors',
          'placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20',
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
