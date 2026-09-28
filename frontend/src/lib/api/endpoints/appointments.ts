import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  Appointment,
  AppointmentListResponse,
  AppointmentQuery,
  AvailabilityCalendarDay,
  AvailabilityCalendarQuery,
  AvailableDoctor,
  AvailableDoctorsQuery,
  BookGuestAppointmentRequest,
  BookGuestAppointmentResponse,
  CancelAppointmentRequest,
  CheckInAppointmentRequest,
  CheckInResponse,
  ConfirmCheckInPaymentRequest,
  ConfirmGuestAppointmentOtpRequest,
  CreateAppointmentRequest,
  RejectAppointmentRequest,
  RequestGuestAppointmentOtpRequest,
  RequestGuestAppointmentOtpResponse,
  UpdateAppointmentRequest,
} from '@/types/appointments';

export const appointmentsApi = {
  // ─── Queries (GET) — trả về data trực tiếp ─────────────────────────────────
  list(query: AppointmentQuery = {}) {
    return unwrap<AppointmentListResponse>(apiClient.get('/appointments', { params: query }));
  },
  availableDoctors(query: AvailableDoctorsQuery) {
    return unwrap<AvailableDoctor[]>(apiClient.get('/appointments/available-doctors', { params: query }));
  },
  availabilityCalendar(query: AvailabilityCalendarQuery) {
    return unwrap<AvailabilityCalendarDay[]>(
      apiClient.get('/appointments/availability-calendar', { params: query }),
    );
  },

  // ─── Mutations — trả về { data, message } để hook đọc result.message ───────
  create(input: CreateAppointmentRequest) {
    return unwrapResult<Appointment>(apiClient.post('/appointments', input));
  },
  // Public, no-auth endpoint: registers the patient + books their first
  // appointment in one call. Uses `unwrap` (not `unwrapResult`) because the
  // response shape mirrors POST /auth/register (LoginResponse plus the new
  // appointment), not the { data, message } appointment-mutation shape.
  bookGuest(input: BookGuestAppointmentRequest) {
    return unwrap<BookGuestAppointmentResponse>(apiClient.post('/appointments/guest', input));
  },
  // Version-up 0.2 item #7 two-step guest-booking OTP flow. Step (a): sends
  // an OTP to the given email and returns an opaque token carrying the
  // booking payload — no account/appointment created yet. Uses `unwrap`
  // (not `unwrapResult`) — same rationale as bookGuest below, the caller
  // needs the token/email/expiresInMinutes payload directly, and the OTP
  // page already shows its own "mã đã gửi tới <email>" confirmation UI so
  // the backend's message string isn't needed separately.
  requestGuestOtp(input: RequestGuestAppointmentOtpRequest) {
    return unwrap<RequestGuestAppointmentOtpResponse>(apiClient.post('/appointments/guest/otp', input));
  },
  // Step (b): verifies the OTP and actually creates the account+appointment.
  // Same response shape as bookGuest above (LoginResponse plus the new
  // appointment) — same `unwrap` rationale as that endpoint.
  confirmGuestOtp(input: ConfirmGuestAppointmentOtpRequest) {
    return unwrap<BookGuestAppointmentResponse>(apiClient.post('/appointments/guest/confirm', input));
  },
  update(id: string, input: UpdateAppointmentRequest) {
    return unwrapResult<Appointment>(apiClient.put(`/appointments/${id}`, input));
  },
  checkIn(id: string, input: CheckInAppointmentRequest) {
    return unwrapResult<CheckInResponse>(apiClient.patch(`/appointments/${id}/check-in`, input));
  },
  // Payment-before-queue change (2026-08-21): second check-in step — collects
  // the exam fee and only then creates the Visit/queue number.
  confirmCheckInPayment(id: string, input: ConfirmCheckInPaymentRequest) {
    return unwrapResult<CheckInResponse>(apiClient.patch(`/appointments/${id}/confirm-checkin-payment`, input));
  },
  cancel(id: string, input: CancelAppointmentRequest) {
    return unwrapResult<Appointment>(apiClient.patch(`/appointments/${id}/cancel`, input));
  },
  confirm(id: string) {
    return unwrapResult<Appointment>(apiClient.patch(`/appointments/${id}/confirm`));
  },
  reject(id: string, input: RejectAppointmentRequest) {
    return unwrapResult<Appointment>(apiClient.patch(`/appointments/${id}/reject`, input));
  },
};
