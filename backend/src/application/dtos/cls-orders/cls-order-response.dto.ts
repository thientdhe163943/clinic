import { ClsOrder } from '../../../domain/entities/cls-order.entity';
import { ClsOrderStatus } from '../../../domain/enums/cls-order-status.enum';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { ClsResultAttachment, LabResultRow } from '../../../domain/repositories/cls-order.repository';

export interface ClsOrderResponseDto {
  id: string;
  visitId: string;
  clsRoomId: string;
  clsRoomName: string;
  clsRoomCategory: ClsRoomCategory | null;
  serviceId: string;
  serviceName: string;
  patientName: string;
  patientCode: string;
  dateOfBirth: Date | null;
  gender: string;
  doctorName: string;
  appointmentTime: Date;
  note: string | null;
  status: ClsOrderStatus;
  calledAt: Date | null;
  createdAt: Date;
  resultSummary: string | null;
  resultAttachments: ClsResultAttachment[];
  resultRows: LabResultRow[] | null;
  resultFindings: string | null;
}

export function toClsOrderResponse(
  order: ClsOrder,
  serviceName: string,
  clsRoomName: string,
  patientName: string,
  patientCode: string,
  dateOfBirth: Date | null,
  gender: string,
  doctorName: string,
  appointmentTime: Date,
  resultSummary: string | null,
  resultAttachments: ClsResultAttachment[],
  resultRows: LabResultRow[] | null = null,
  clsRoomCategory: ClsRoomCategory | null = null,
  resultFindings: string | null = null,
): ClsOrderResponseDto {
  return {
    id: order.id,
    visitId: order.visitId,
    clsRoomId: order.clsRoomId,
    clsRoomName,
    clsRoomCategory,
    serviceId: order.serviceId,
    serviceName,
    patientName,
    patientCode,
    dateOfBirth,
    gender,
    doctorName,
    appointmentTime,
    note: order.note,
    status: order.status,
    calledAt: order.calledAt,
    createdAt: order.createdAt,
    resultSummary,
    resultAttachments,
    resultRows,
    resultFindings,
  };
}
