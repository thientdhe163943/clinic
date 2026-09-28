'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';

interface InvoiceChangedPayload {
  invoiceId: string;
}

// Live-refetches the invoices list whenever an invoice is created/paid
// elsewhere. Received by RECEPTIONIST + ADMIN role rooms. Uses the tab-wide
// shared socket (see src/lib/realtime/socket.ts).
export function useInvoiceEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (_payload: InvoiceChangedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    };

    socket.on('invoice:changed', handler);

    return () => {
      socket.off('invoice:changed', handler);
    };
  }, [queryClient]);
}
