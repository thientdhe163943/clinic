import { Visit } from '../../../domain/entities/visit.entity';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';

export interface VisitResponseDto {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  roomId: string;
  queueNumber: string | null;
  priority: VisitPriority;
  status: VisitStatus;
  serviceName: string;
  appointmentTime: Date;
  calledAt: Date | null;
  calledCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  // Ghi chú/lý do khám lễ tân nhập lúc tạo lịch hẹn.
  note: string | null;
}

export function toVisitResponse(
  visit: Visit,
  patientName: string,
  patientCode: string,
  doctorName: string,
  serviceName: string,
  appointmentTime: Date,
  note: string | null,
  patientPhone: string,
): VisitResponseDto {
  return {
    id: visit.id,
    appointmentId: visit.appointmentId,
    patientId: visit.patientId,
    patientName,
    patientCode,
    patientPhone,
    doctorId: visit.doctorId,
    doctorName,
    roomId: visit.roomId,
    queueNumber: visit.queueNumber,
    priority: visit.priority,
    status: visit.status,
    serviceName,
    appointmentTime,
    calledAt: visit.calledAt,
    calledCount: visit.calledCount,
    startedAt: visit.startedAt,
    completedAt: visit.completedAt,
    createdAt: visit.createdAt,
    note,
  };
}
