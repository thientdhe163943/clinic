import { PaginationMeta } from '../pagination.dto';
import { Appointment } from '../../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../../domain/enums/appointment-status.enum';

export interface AppointmentResponseDto {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  doctorId: string | null;
  doctorName: string;
  serviceId: string | null;
  serviceName: string;
  roomId: string | null;
  appointmentTime: Date;
  status: AppointmentStatus;
  note: string | null;
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: Date | null;
  checkedInAt: Date | null;
  bookedBy: string;
  createdAt: Date;
  updatedAt: Date;
  /** Only populated by ListAppointmentsUseCase (the sole way the frontend
   * fetches a single appointment's detail — see useAppointmentDetail).
   * Undefined elsewhere (create/confirm/cancel/... responses). */
  visitId?: string | null;
  /** Same caveat as visitId — only populated by ListAppointmentsUseCase. */
  roomName?: string | null;
}

export interface AppointmentListResponseDto {
  items: AppointmentResponseDto[];
  meta: PaginationMeta;
}

export function toAppointmentResponse(
  appointment: Appointment,
  patientName: string,
  patientCode: string,
  doctorName: string,
  serviceName: string,
): AppointmentResponseDto {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    patientName,
    patientCode,
    doctorId: appointment.doctorId,
    doctorName,
    serviceId: appointment.serviceId,
    serviceName,
    roomId: appointment.roomId,
    appointmentTime: appointment.appointmentTime,
    status: appointment.status,
    note: appointment.note,
    cancelReason: appointment.cancelReason,
    cancelledBy: appointment.cancelledBy,
    cancelledAt: appointment.cancelledAt,
    checkedInAt: appointment.checkedInAt,
    bookedBy: appointment.bookedBy,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}
