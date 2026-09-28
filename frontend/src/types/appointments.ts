import type { PaginationMeta } from './api';
import type { LoginResponse } from './auth';
import type { Gender } from './patients';
import type { Invoice, PaymentMethod } from './invoices';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  // Backend now allows booking without a doctor/service assigned yet (walk-in
  // consult-first flow) — null means "not yet assigned".
  doctorId: string | null;
  doctorName: string;
  serviceId: string | null;
  serviceName: string;
  roomId: string | null;
  appointmentTime: string;
  status: AppointmentStatus;
  note: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  checkedInAt: string | null;
  bookedBy: string;
  createdAt: string;
  updatedAt: string;
  // Only present on the detail fetch (useAppointmentDetail) — the visit
  // created at check-in, if any. Lets the receptionist re-print the
  // admission slip later without a dedicated GET /visits/:id endpoint.
  visitId?: string | null;
  // Same caveat as visitId — resolved from appointment.roomId, which is only
  // set once check-in has locked in the room (Feature 60); null beforehand.
  roomName?: string | null;
}

export interface AppointmentListResponse {
  items: Appointment[];
  meta: PaginationMeta;
}

export interface AppointmentQuery {
  date?: string;
  doctorId?: string;
  patientId?: string;
  // Backend's ListAppointmentsQueryDto only declares `statuses` (array) —
  // sending `status` (singular) trips forbidNonWhitelisted (main.ts) and the
  // whole request 400s. A bare string still works: the DTO's @Transform
  // wraps a non-array value into a single-element array. An actual array
  // here is sent as repeated `statuses=A&statuses=B` query keys (axios's
  // default array serialization), which Express's query parser collects
  // back into an array — matching what the DTO's @IsArray() expects.
  statuses?: AppointmentStatus | AppointmentStatus[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateAppointmentRequest {
  patientId?: string;
  // Optional — an appointment can be booked without a doctor/service chosen
  // yet (e.g. "chưa biết chọn dịch vụ/bác sĩ phù hợp", assigned later by
  // reception after in-clinic consultation).
  doctorId?: string;
  serviceId?: string;
  appointmentTime: string;
  note?: string;
}

export interface UpdateAppointmentRequest {
  // string | null | undefined: undefined (omitted) means "leave unchanged";
  // null is an explicit "clear back to unassigned" — the receptionist detail
  // page always sends one or the other, never omits these on submit.
  doctorId?: string | null;
  serviceId?: string | null;
  appointmentTime?: string;
  note?: string | null;
}

export type VisitPriority = 'NORMAL' | 'ELDERLY' | 'PREGNANT' | 'CHILD' | 'EMERGENCY';

export interface CheckInAppointmentRequest {
  priority?: VisitPriority;
}

export interface CancelAppointmentRequest {
  reason: string;
}

export interface RejectAppointmentRequest {
  reason: string;
}

export type VisitStatus = 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'AWAITING_RESULTS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';

export interface Visit {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  roomId: string;
  queueNumber: string;
  priority: VisitPriority;
  status: VisitStatus;
  createdAt: string;
}

export interface CheckInResponse {
  appointment: Appointment;
  /**
   * Payment-before-queue change (2026-08-21): check-in itself no longer
   * creates the Visit — undefined here, only present once
   * confirmCheckInPayment succeeds and the patient actually enters the
   * queue.
   */
  visit?: Visit;
  /**
   * Version-up 0.2 item #10: the invoice created right at check-in (with its
   * UNPAID exam-fee line) — null when the appointment had no serviceId
   * selected, in which case nothing is billed yet.
   */
  invoice: Invoice | null;
}

export interface ConfirmCheckInPaymentRequest {
  priority?: VisitPriority;
  paymentMethod: PaymentMethod;
  note?: string;
}

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface AppointmentSlot {
  time: string;
  datetime: string;
  available: boolean;
}

export interface AvailableDoctorShift {
  shift: ShiftType;
  roomId: string | null;
  roomName: string | null;
  startHour: number;
  endHour: number;
  slots: AppointmentSlot[];
}

export interface AvailableDoctor {
  doctorId: string;
  doctorName: string;
  shifts: AvailableDoctorShift[];
}

export interface AvailableDoctorsQuery {
  serviceId: string;
  date: string;
}

export interface AvailabilityCalendarQuery {
  serviceId: string;
  /** "YYYY-MM" */
  month: string;
}

export interface AvailabilityCalendarDay {
  /** "YYYY-MM-DD" */
  date: string;
  hasAvailability: boolean;
}

// Public, no-auth booking: registers a new patient account and books their
// first appointment in one call. Response mirrors POST /auth/register
// (LoginResponse) since the backend logs the caller in on success. No
// password field — the account starts on the default patient password
// (mustChangePassword: true forces the guest to set their own on first
// login), same as a receptionist-created walk-in patient.
export interface BookGuestAppointmentRequest {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  appointmentTime: string;
  email?: string;
  gender?: Gender;
  idCard?: string;
  doctorId?: string;
  serviceId?: string;
  note?: string;
}

// Backend returns the usual LoginResponse shape plus the appointment just
// created, so a caller can show a booking confirmation without a follow-up
// fetch.
export interface BookGuestAppointmentResponse extends LoginResponse {
  appointment: Appointment;
}

// Version-up 0.2 item #7 — two-step guest-booking OTP flow. Step (a): same
// fields as BookGuestAppointmentRequest, except `email` is required (OTP
// delivery is email-only) — no account/appointment is created yet.
export interface RequestGuestAppointmentOtpRequest {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  appointmentTime: string;
  gender?: Gender;
  idCard?: string;
  doctorId?: string;
  serviceId?: string;
  note?: string;
}

export interface RequestGuestAppointmentOtpResponse {
  otpToken: string;
  email: string;
  expiresInMinutes: number;
}

// Step (b): verifies the OTP against the token from step (a) and, only then,
// actually creates the account + appointment — response mirrors the legacy
// one-step POST /appointments/guest (BookGuestAppointmentResponse).
export interface ConfirmGuestAppointmentOtpRequest {
  otpToken: string;
  otpCode: string;
}
