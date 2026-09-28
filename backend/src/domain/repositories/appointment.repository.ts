import { Appointment } from '../entities/appointment.entity';
import { Invoice } from '../entities/invoice.entity';
import { Visit } from '../entities/visit.entity';
import { AppointmentStatus } from '../enums/appointment-status.enum';
import { VisitPriority } from '../enums/visit-priority.enum';
import { CreateInvoiceItemData } from './invoice.repository';

export const APPOINTMENT_REPOSITORY = Symbol('APPOINTMENT_REPOSITORY');

export interface CreateAppointmentData {
  patientId: string;
  doctorId?: string | null;
  serviceId?: string | null;
  scheduleId?: string | null;
  appointmentTime: Date;
  status: AppointmentStatus;
  note?: string | null;
  bookedBy: string;
}

export interface UpdateAppointmentData {
  doctorId?: string | null;
  serviceId?: string | null;
  scheduleId?: string | null;
  appointmentTime?: Date;
  note?: string | null;
}

export interface AppointmentListFilter {
  date?: Date;
  doctorId?: string;
  patientId?: string;
  statuses?: AppointmentStatus[];
  search?: string;
  page: number;
  limit: number;
  /**
   * Sort direction by appointmentTime. Feature 61 (receptionist list)
   * defaults to 'asc' (soonest appointment first); a patient's own "my
   * appointments" list defaults to 'desc' (most recently booked/newest date
   * first) — see ListAppointmentsUseCase for the role-based default.
   */
  sort?: 'asc' | 'desc';
}

export interface AppointmentListItem {
  appointment: Appointment;
  patientName: string;
  patientCode: string;
  doctorName: string;
  serviceName: string;
  /** The visit created at check-in (Feature 60), if any — lets the receptionist
   * re-print the admission slip later from the appointment detail screen
   * without a dedicated GET /visits endpoint (RECEPTIONIST can't call that one). */
  visitId: string | null;
  /** Resolved from appointment.roomId (only set once check-in has locked in
   * the room, see Feature 60) — null beforehand, matching roomId itself. */
  roomName: string | null;
}

export interface AppointmentHistoryEntry {
  appointmentId: string;
  oldStatus?: AppointmentStatus | null;
  newStatus: AppointmentStatus;
  oldTime?: Date | null;
  newTime?: Date | null;
  oldDoctorId?: string | null;
  newDoctorId?: string | null;
  reason?: string | null;
  changedBy: string;
}

export interface CreateVisitData {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  roomId: string;
  priority?: VisitPriority;
}

/**
 * Version-up 0.2 item #10: the exam-fee InvoiceItem to bill right away,
 * built by InvoiceBillingService.buildExaminationItem() — undefined when the
 * appointment has no serviceId (nothing to bill yet; a later CLS order or
 * the /invoices fallback endpoint will create the invoice instead). Passed
 * through so PrismaAppointmentRepository.checkIn() can create the Invoice
 * inside the very same DB transaction as the Visit/AppointmentHistory
 * writes below.
 */
export interface CheckInInvoiceData {
  createdBy: string;
  item: CreateInvoiceItemData;
}

export interface CheckInData {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  roomId: string;
  priority?: VisitPriority;
  checkedInAt: Date;
  changedBy: string;
  oldStatus: AppointmentStatus;
  invoice?: CheckInInvoiceData;
}

export interface CheckInResult {
  appointment: Appointment;
  /** null when `invoice` wasn't provided (no service selected at booking). */
  invoice: Invoice | null;
}

/**
 * Payment-before-queue change (2026-08-21): the Visit (and its queue
 * number) is now created here, separately from checkIn() above, once the
 * exam fee has actually been collected — see ConfirmCheckInPaymentUseCase.
 */
export interface CreateVisitForCheckInData {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  roomId: string;
  priority?: VisitPriority;
}

export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  /**
   * Version-up 0.2 item #7 (anti-spam business rule #2): counts a patient's
   * still-actionable future appointments (PENDING/CONFIRMED with
   * appointmentTime >= `from`) — used to cap how many "open" bookings a
   * single patient may hold at once. `from` is expected as a clinic-naive-UTC
   * instant (see clinic-calendar.util.ts), matching how appointmentTime
   * itself is stored/compared everywhere else in this repository.
   */
  countActiveByPatient(patientId: string, from: Date): Promise<number>;
  findConflict(patientId: string, appointmentTime: Date, excludeId?: string): Promise<Appointment | null>;
  findDoctorConflict(doctorId: string, appointmentTime: Date, excludeId?: string): Promise<Appointment | null>;
  /**
   * Version-up 0.2 Phase 2 #9 tình huống B: appointments still tied to a
   * given WorkSchedule shift (via scheduleId) with one of the given
   * statuses — used by ReassignScheduleDoctorUseCase to find every
   * PENDING/CONFIRMED appointment that must move to the substitute doctor.
   */
  findByScheduleId(scheduleId: string, statuses: AppointmentStatus[]): Promise<Appointment[]>;
  findMany(filter: AppointmentListFilter): Promise<{ items: AppointmentListItem[]; total: number }>;
  create(data: CreateAppointmentData): Promise<Appointment>;
  update(id: string, data: UpdateAppointmentData): Promise<Appointment>;
  updateStatus(
    id: string,
    status: AppointmentStatus,
    extra?: {
      cancelReason?: string | null;
      cancelledBy?: string | null;
      cancelledAt?: Date | null;
      checkedInAt?: Date | null;
      roomId?: string | null;
    },
  ): Promise<Appointment>;
  addHistory(entry: AppointmentHistoryEntry): Promise<void>;
  createVisit(data: CreateVisitData): Promise<Visit>;

  /**
   * End-of-day cleanup (Feature: auto-cancel): PENDING/CONFIRMED appointments
   * with appointmentTime before `cutoff` were never checked in — cancel them
   * and record history for each. Returns the number cancelled.
   */
  cancelStaleBefore(cutoff: Date, systemActorId: string): Promise<number>;

  /**
   * Atomically: updates the appointment to CHECKED_IN with the resolved
   * room/checkedInAt, inserts an AppointmentHistory row, and — version-up
   * 0.2 item #10 — creates the appointment's Invoice (with its exam-fee
   * line, UNPAID) when `data.invoice` is given, all in the same transaction.
   * Payment-before-queue change (2026-08-21): this no longer creates the
   * Visit/queue number — see createVisitForCheckIn() below, called once the
   * exam fee is actually collected (ConfirmCheckInPaymentUseCase).
   */
  checkIn(data: CheckInData): Promise<CheckInResult>;

  /**
   * Locks the room (same `FOR UPDATE` pattern as the old checkIn()) and
   * creates the Visit(WAITING) with an auto-generated queueNumber, given
   * priority or NORMAL. Called by ConfirmCheckInPaymentUseCase only after
   * the exam fee has been collected (or there was nothing to collect) — the
   * patient does not appear in the doctor's queue before this runs.
   */
  createVisitForCheckIn(data: CreateVisitForCheckInData): Promise<Visit>;
}
