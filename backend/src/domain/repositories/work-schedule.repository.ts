import { WorkSchedule } from '../entities/work-schedule.entity';
import { ShiftType } from '../enums/shift-type.enum';

export const WORK_SCHEDULE_REPOSITORY = Symbol('WORK_SCHEDULE_REPOSITORY');

export interface WorkScheduleShift {
  id: string;
  userId: string;
  roomId: string | null;
  workDate: Date;
  shift: 'MORNING' | 'AFTERNOON' | 'FULL_DAY';
}

export interface WorkScheduleListItem {
  schedule: WorkSchedule;
  userName: string;
  userRole: string;
  roomCode: string | null;
  roomName: string | null;
}

export interface WorkScheduleListFilter {
  userId?: string;
  role?: string;
  from?: Date;
  to?: Date;
}

export interface LinkedAppointmentInfo {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentTime: Date;
  status: string;
}

export interface CreateWorkScheduleData {
  userId: string;
  roomId: string;
  workDate: Date;
  shift: ShiftType;
  note?: string | null;
  createdBy: string;
}

export interface UpdateWorkScheduleData {
  roomId: string;
  workDate: Date;
  shift: ShiftType;
  note?: string | null;
  updatedBy: string;
}

/**
 * Version-up 0.2 Phase 2 #9 (Tình huống B): overwrites just the assigned
 * doctor on an existing shift (leaving roomId/workDate/shift untouched) —
 * used by ReassignScheduleDoctorUseCase instead of update() above, which
 * requires a full roomId/workDate/shift payload unrelated to this flow.
 */
export interface ReassignDoctorData {
  userId: string;
  originalUserId: string;
  absentNote: string;
  updatedBy: string;
}

/**
 * Port for the work_schedules table. Features 39-42 (full CRUD) live here
 * alongside the original read-only `findCoveringShift`, which the Appointment
 * feature depends on to validate that a doctor has a shift covering a given
 * appointment slot (Features 59 and 63) — kept untouched.
 */
export interface WorkScheduleRepository {
  /** Finds the work schedule shift (if any) for doctorId that covers the given datetime. */
  findCoveringShift(doctorId: string, datetime: Date): Promise<WorkScheduleShift | null>;

  findById(id: string): Promise<WorkSchedule | null>;

  /** Finds a conflicting shift for the same user/date/shift (mirrors the DB unique constraint), excluding excludeId when given. */
  findConflict(userId: string, workDate: Date, shift: ShiftType, excludeId?: string): Promise<WorkSchedule | null>;

  /** Finds another staff member's shift already assigned to the same room/date/shift (added 2026-07-08, Feature 39 A4). */
  findRoomConflict(roomId: string, workDate: Date, shift: ShiftType, role: string, excludeId?: string): Promise<WorkSchedule | null>;

  findMany(filter: WorkScheduleListFilter): Promise<WorkScheduleListItem[]>;

  /** Existing shifts for userId within [fromDate, toDate] — used to warn Admin when registering a leave (Feature 39/42b, added 2026-07-09). */
  findManyByUserAndDateRange(userId: string, fromDate: Date, toDate: Date): Promise<WorkScheduleListItem[]>;

  hasLinkedAppointments(scheduleId: string): Promise<boolean>;

  /** Detail list (patient name/phone/time) behind hasLinkedAppointments — used
   * to warn Admin with who to call before an edit changes room/date/shift. */
  findLinkedAppointments(scheduleId: string): Promise<LinkedAppointmentInfo[]>;

  create(data: CreateWorkScheduleData): Promise<WorkSchedule>;

  update(id: string, data: UpdateWorkScheduleData): Promise<WorkSchedule>;

  /** See ReassignDoctorData above — Version-up 0.2 Phase 2 #9 tình huống B. */
  reassignDoctor(id: string, data: ReassignDoctorData): Promise<WorkSchedule>;

  delete(id: string): Promise<void>;
}
