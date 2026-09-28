import { WorkSchedule } from '../../../domain/entities/work-schedule.entity';
import { ShiftType } from '../../../domain/enums/shift-type.enum';
import { LinkedAppointmentInfo } from '../../../domain/repositories/work-schedule.repository';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';

export interface LinkedAppointmentDto {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentTime: Date;
  status: string;
}

export interface ScheduleResponseDto {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  roomId: string | null;
  roomCode: string | null;
  roomName: string | null;
  workDate: Date;
  shift: ShiftType;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string | null;
  // Version-up 0.2 Phase 2 #9 tình huống B — set once ReassignScheduleDoctorUseCase
  // swaps a substitute doctor onto this shift; originalUserId is the doctor
  // originally assigned before the first reassignment (unchanged thereafter).
  isAbsent: boolean;
  absentNote: string | null;
  originalUserId: string | null;
  hasLinkedAppointments?: boolean;
  // Only populated on GetScheduleUseCase (single-schedule fetch) — the admin
  // edit screen shows this list so reception knows exactly who to call if
  // room/date/shift is changed. Left undefined elsewhere (list view) to
  // avoid an N+1 query per row.
  linkedAppointments?: LinkedAppointmentDto[];
}

export function toScheduleResponse(
  schedule: WorkSchedule,
  userName: string,
  userRole: string,
  roomCode: string | null,
  roomName: string | null,
  hasLinkedAppointments?: boolean,
  linkedAppointments?: LinkedAppointmentInfo[],
): ScheduleResponseDto {
  return {
    id: schedule.id,
    userId: schedule.userId,
    userName: DoctorDisplayName.formatForRole(userName, userRole),
    userRole,
    roomId: schedule.roomId,
    roomCode,
    roomName,
    workDate: schedule.workDate,
    shift: schedule.shift,
    note: schedule.note,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    createdBy: schedule.createdBy,
    updatedBy: schedule.updatedBy,
    isAbsent: schedule.isAbsent,
    absentNote: schedule.absentNote,
    originalUserId: schedule.originalUserId,
    ...(hasLinkedAppointments !== undefined ? { hasLinkedAppointments } : {}),
    ...(linkedAppointments !== undefined ? { linkedAppointments } : {}),
  };
}
