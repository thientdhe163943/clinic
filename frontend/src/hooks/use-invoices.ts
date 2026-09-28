'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '@/lib/api/endpoints/invoices';
import { useNotificationStore } from '@/stores/notification.store';
import type { CreateInvoiceRequest, InvoiceQuery, PayInvoiceRequest } from '@/types/invoices';
import type { ApiError } from '@/types/api';

export function useInvoices(query: InvoiceQuery = {}, enabled = true) {
  return useQuery({
    queryKey: ['invoices', query],
    queryFn: () => invoicesApi.list(query),
    enabled,
  });
}

export function useInvoiceByAppointment(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'by-appointment', appointmentId],
    queryFn: () => invoicesApi.getByAppointment(appointmentId as string),
    enabled: Boolean(appointmentId),
    retry: false,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateInvoiceRequest) => invoicesApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function usePayInvoice() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PayInvoiceRequest }) => invoicesApi.pay(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}
