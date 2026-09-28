'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getRealtimeSocket } from '@/lib/realtime/socket';

interface ClsOrderChangedPayload {
  clsOrderId: string;
}

// Live-refetches CLS-order queries on two different events:
//  - `cls-order:changed` — received by the LAB_TECH role room whenever any
//    CLS order is created/updated (drives the lab queue page).
//  - `cls-order:result-ready` — received by the ordering doctor's own userId
//    room once a result has been entered (drives the doctor's CLS tab on a
//    visit so the result shows up without a manual refresh).
// Both use-cls-orders.ts (QUERY_KEY = 'cls-orders') and the CLS-related
// queries in use-visits.ts (`['cls-orders', visitId]`, `['cls-orders',
// 'all', ...]`) share the same 'cls-orders' key prefix, so a single
// invalidation by that prefix covers every CLS-order query in the app. Uses
// the tab-wide shared socket (see src/lib/realtime/socket.ts).
export function useClsOrderEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handler = (_payload: ClsOrderChangedPayload) => {
      void queryClient.invalidateQueries({ queryKey: ['cls-orders'] });
    };

    socket.on('cls-order:changed', handler);
    socket.on('cls-order:result-ready', handler);

    return () => {
      socket.off('cls-order:changed', handler);
      socket.off('cls-order:result-ready', handler);
    };
  }, [queryClient]);
}
