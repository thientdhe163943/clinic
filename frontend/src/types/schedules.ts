import type { UserRole } from '@/types/auth';

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface LinkedAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  appointmentTime: string;
  status: string;
}

export interface Schedule {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  roomId: string;
  roomCode: string;
  roomName: string;
  workDate: string;
  shift: ShiftType;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string | null;
  hasLinkedAppointments?: boolean;
  // Chỉ có khi fetch chi tiết 1 lịch (GET /schedules/:id) — dùng để cảnh báo
  // admin gọi điện cho đúng bệnh nhân trước khi đổi phòng/ngày/ca.
  linkedAppointments?: LinkedAppointment[];
  // Version-up 0.2 Phase 2 #9 tình huống B — set once ReassignScheduleDoctor
  // (PATCH /schedules/:id/reassign) swaps a substitute doctor onto this
  // shift. Exposed on both list and detail responses (schedule-response.dto.ts),
  // not just the reassign mutation's own response. `userName`/`userId` above
  // already reflect the *current* (substitute) doctor after a reassignment —
  // `originalUserId` only records who was on the shift before the first swap.
  isAbsent: boolean;
  absentNote: string | null;
  originalUserId: string | null;
}

export interface ListSchedulesQuery {
  userId?: string;
  role?: UserRole | '';
  from?: string;
  to?: string;
}

export interface CreateScheduleRequest {
  userId: string;
  roomId: string;
  workDate: string;
  shift: ShiftType;
  note?: string;
}

export interface UpdateScheduleRequest {
  roomId: string;
  workDate: string;
  shift: ShiftType;
  note?: string;
}

// ─── Bulk / recurring schedule creation (Feature 39, bổ sung 2026-07-09) ────

export interface CreateBulkScheduleRequest {
  userId: string;
  roomId: string;
  shift: ShiftType;
  fromDate: string;
  toDate: string;
  /** 0 = Chủ nhật ... 6 = Thứ bảy */
  daysOfWeek: number[];
  note?: string;
}

export interface BulkScheduleSkip {
  date: string;
  /** Mã lỗi thô từ backend (VD "MSG_ERR_0031") — map sang nhãn ở FE. */
  reason: string;
}

export interface BulkScheduleResult {
  created: Schedule[];
  skipped: BulkScheduleSkip[];
}

// ─── Reassign doctor on absence (Version-up 0.2 Phase 2 #9 tình huống B) ────

export interface ReassignScheduleDoctorRequest {
  substituteDoctorId: string;
  /** Tối đa 255 ký tự — khớp work_schedules.absent_note VARCHAR(255). */
  reason: string;
}

export interface ReassignScheduleDoctorResult extends Schedule {
  affectedAppointmentIds: string[];
}
