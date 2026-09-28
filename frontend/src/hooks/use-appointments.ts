'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { appointmentsApi } from '@/lib/api/endpoints/appointments';
import { getRoleHome } from '@/lib/auth/routes';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import type {
  AppointmentQuery,
  BookGuestAppointmentRequest,
  BookGuestAppointmentResponse,
  CancelAppointmentRequest,
  CheckInAppointmentRequest,
  ConfirmCheckInPaymentRequest,
  ConfirmGuestAppointmentOtpRequest,
  CreateAppointmentRequest,
  RejectAppointmentRequest,
  RequestGuestAppointmentOtpRequest,
  UpdateAppointmentRequest,
} from '@/types/appointments';
import type { ApiError } from '@/types/api';

export function useAppointments(query: AppointmentQuery = {}) {
  return useQuery({
    queryKey: ['appointments', query],
    queryFn: () => appointmentsApi.list(query),
  });
}

// Backend filters by specialty + that day's work schedule; only fetch once
// both a service and a date are chosen (Phần 4b/4c booking flow redesign).
export function useAvailableDoctors(serviceId: string, date: string) {
  return useQuery({
    queryKey: ['appointments', 'available-doctors', serviceId, date],
    queryFn: () => appointmentsApi.availableDoctors({ serviceId, date }),
    enabled: Boolean(serviceId) && Boolean(date),
  });
}

// Powers the booking calendar (BookingCalendar) — greys out days that are
// fully booked or in the past for the chosen service. Only meaningful once a
// service is picked, same gating rule as useAvailableDoctors.
export function useAvailabilityCalendar(serviceId: string, month: string) {
  return useQuery({
    queryKey: ['appointments', 'availability-calendar', serviceId, month],
    queryFn: () => appointmentsApi.availabilityCalendar({ serviceId, month }),
    enabled: Boolean(serviceId),
  });
}

// Backend doesn't expose GET /appointments/:id. Design choice: fetch a large
// unfiltered page of /appointments (limit 100, newest-first per backend
// default ordering) and find the matching row client-side, rather than
// reusing `search` (which backend matches against patient name/code/phone,
// not appointment id — it would silently miss). This is a deliberate
// trade-off for a receptionist-scale dataset; if appointment volume grows
// past ~100 concurrent/recent rows this should be replaced by a real
// GET /appointments/:id backend endpoint.
export function useAppointmentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['appointments', 'detail', id],
    queryFn: async () => {
      const result = await appointmentsApi.list({ limit: 100 });
      return result.items.find((item) => item.id === id) ?? null;
    },
    enabled: Boolean(id),
  });
}

export function useCreateAppointment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateAppointmentRequest) => appointmentsApi.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

// Public, no-auth booking (guest-booking page): registers the patient +
// books their first appointment in one call, then logs them straight in.
// Does NOT redirect on success — the page shows a credentials/login-info
// dialog first (the guest has no other way to learn their login identifier
// + default password) and navigates only after the guest dismisses it, via
// useGuestBookingRedirect below.
export function useBookGuestAppointment() {
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: (data: BookGuestAppointmentRequest) => appointmentsApi.bookGuest(data),
    onSuccess: (session) => {
      setSession(session);
    },
  });
}

// Version-up 0.2 item #7, step (a) of the two-step guest-booking OTP flow:
// sends an OTP to the given email, returning an opaque token (and
// expiresInMinutes for the page's countdown) — no account/appointment
// created yet. No success toast — the OTP page's own UI already confirms
// the email the code was sent to. Failures (throttle/pending-limit/etc) are
// toasted via err.message, same as every other mutation hook in this file.
export function useRequestGuestAppointmentOtp() {
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: RequestGuestAppointmentOtpRequest) => appointmentsApi.requestGuestOtp(data),
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

// Step (b): verifies the OTP and actually creates the account + books the
// appointment, then logs the guest in — same "no redirect on success" shape
// as useBookGuestAppointment (the page shows the credentials dialog first).
// Errors (invalid/expired OTP, throttle, pending-limit) are toasted here
// since — unlike the legacy one-step flow — the OTP page has no single
// inline error slot that fits both the request and confirm steps.
export function useConfirmGuestAppointmentOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: ConfirmGuestAppointmentOtpRequest) => appointmentsApi.confirmGuestOtp(data),
    onSuccess: (session) => {
      setSession(session);
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

// Call after the guest dismisses the post-booking credentials dialog —
// mirrors the redirect useAuth()'s register mutation does immediately, just
// deferred until the dialog closes.
export function useGuestBookingRedirect() {
  const router = useRouter();
  return (session: BookGuestAppointmentResponse) => {
    if (session.mustChangePassword) {
      router.replace('/change-password');
      return;
    }
    router.replace(getRoleHome(session.user.role));
  };
}

export function useUpdateAppointment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAppointmentRequest }) =>
      appointmentsApi.update(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useCheckInAppointment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CheckInAppointmentRequest }) =>
      appointmentsApi.checkIn(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

// Payment-before-queue change (2026-08-21): second check-in step — see
// appointmentsApi.confirmCheckInPayment.
export function useConfirmCheckInPayment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConfirmCheckInPaymentRequest }) =>
      appointmentsApi.confirmCheckInPayment(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CancelAppointmentRequest }) =>
      appointmentsApi.cancel(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useConfirmAppointment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => appointmentsApi.confirm(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useRejectAppointment() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RejectAppointmentRequest }) =>
      appointmentsApi.reject(id, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

