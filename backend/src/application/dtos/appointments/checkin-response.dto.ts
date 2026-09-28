import { AppointmentResponseDto } from './appointment-response.dto';
import { InvoiceResponseDto } from '../invoices/invoice-response.dto';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';

export interface VisitResponseDto {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  roomId: string;
  queueNumber: string | null;
  priority: VisitPriority;
  status: VisitStatus;
  createdAt: Date;
}

export interface CheckInResponseDto {
  appointment: AppointmentResponseDto;
  /**
   * Payment-before-queue change (2026-08-21): check-in itself no longer
   * creates the Visit — undefined here, only present in
   * ConfirmCheckInPaymentUseCase's response once the exam fee is collected
   * and the patient actually enters the queue.
   */
  visit?: VisitResponseDto;
  /**
   * Version-up 0.2 item #10: the invoice created right at check-in (with its
   * UNPAID exam-fee line) — null when the appointment had no serviceId
   * selected, in which case nothing is billed yet. The receptionist UI uses
   * this to know how much to collect before confirming payment.
   */
  invoice: InvoiceResponseDto | null;
}
