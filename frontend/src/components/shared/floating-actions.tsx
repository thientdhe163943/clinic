'use client';

import { CalendarPlus } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useHasMounted } from '@/hooks/use-has-mounted';

// Sits bottom-left (AiChatWidget owns bottom-right, see patient-site-shell.tsx)
// so the two floating stacks never overlap.
export function FloatingActions() {
  const { isAuthenticated } = useAuth();
  const hasMounted = useHasMounted();
  const showAuthenticatedUI = hasMounted && isAuthenticated;
  const bookingHref = showAuthenticatedUI ? '/book-appointment' : '/guest-booking';

  return (
    <div className="fixed bottom-5 left-5 z-40 flex flex-col gap-3">
      <Link
        href={bookingHref}
        aria-label="Đặt lịch khám"
        title="Đặt lịch khám"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-600 text-white shadow-lg shadow-primary/40 transition-transform hover:scale-105"
      >
        <CalendarPlus className="h-6 w-6" />
      </Link>
    </div>
  );
}
