import { ExaminationResult } from '../entities/examination-result.entity';
import { Visit } from '../entities/visit.entity';
import { VisitStatus } from '../enums/visit-status.enum';

export const VISIT_REPOSITORY = Symbol('VISIT_REPOSITORY');

export interface VisitListFilter {
  doctorId?: string;
  roomId?: string;
  date?: string;
  status?: VisitStatus;
}

export interface VisitListItem {
  visit: Visit;
  patientName: string;
  patientCode: string;
  patientPhone: string;
  doctorName: string;
  serviceName: string;
  appointmentTime: Date;
  checkedInAt: Date | null;
  // Ghi chú/lý do khám lễ tân nhập lúc tạo lịch hẹn — hiển thị cho bác sĩ/y
  // tá xem ngay từ đầu thay vì chỉ lễ tân thấy được.
  note: string | null;
}

export interface CreateExaminationResultData {
  visitId: string;
  diagnosis: string;
  clinicalNote?: string | null;
  treatmentResult?: string | null;
  followUpDate?: Date | null;
  accessCode: string;
  accessCodeExpiresAt?: Date | null;
  createdBy: string;
}

export interface UpdateExaminationResultData {
  diagnosis?: string;
  clinicalNote?: string | null;
  treatmentResult?: string | null;
  followUpDate?: Date | null;
  updatedBy: string;
}

export interface VitalSignsData {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  temperature?: number | null;
  spo2?: number | null;
  weight?: number | null;
  height?: number | null;
  recordedBy: string;
}

export interface VitalSignsRecord {
  id: string;
  visitId: string;
  systolicBp: number | null;
  diastolicBp: number | null;
  heartRate: number | null;
  temperature: number | null;
  spo2: number | null;
  weight: number | null;
  height: number | null;
  recordedBy: string;
  recordedAt: Date;
}

export interface ClsSummaryItem {
  serviceName: string;
  clsRoomCategory: string | null;
  summary: string | null;
  resultRows: { name: string; result: string; unit?: string; normalRange?: string; note?: string }[] | null;
  resultFindings: string | null;
}

export interface ExaminationResultWithVisit {
  result: ExaminationResult;
  visit: Visit;
  patientName: string;
  patientCode: string;
  patientDateOfBirth: Date | null;
  patientGender: string;
  patientAddress: string | null;
  doctorName: string;
  serviceName: string;
  appointmentTime: Date;
  clsSummaries: ClsSummaryItem[];
}

export interface VisitListItemWithRoom extends VisitListItem {
  roomName: string;
}

export interface RecheckCandidate {
  visitId: string;
  patientId: string;
  followUpDate: Date;
}

export interface VisitRepository {
  findById(id: string): Promise<Visit | null>;
  /** Used by CreateInvoiceUseCase (Feature 64) to locate the visit's CLS
   * orders and prescription for billing — appointment_id is unique on visits. */
  findByAppointmentId(appointmentId: string): Promise<Visit | null>;
  /**
   * Version-up 0.2 item #7 (anti-spam business rule #4): counts a patient's
   * NO_SHOW visits with createdAt >= `since` (a real-UTC instant — Visit's
   * createdAt is a plain `@default(now())` column, unlike Appointment's
   * naive-local appointmentTime) — used to withhold the
   * receptionist-booking auto-CONFIRMED fast-path from repeat no-show
   * patients.
   */
  countNoShowsSince(patientId: string, since: Date): Promise<number>;
  /** Single-visit join used for the queue-ticket print endpoint (Feature 60). */
  findByIdWithDetails(id: string): Promise<VisitListItemWithRoom | null>;
  findListWithDetails(filter: VisitListFilter): Promise<VisitListItem[]>;
  countInProgressByRoom(roomId: string): Promise<number>;
  /** Waiting/NoShow -> Called; updates called_at and increments called_count (Feature 16). */
  callPatient(id: string, calledAt: Date, calledCount: number): Promise<Visit>;
  /** Called/AwaitingResults -> InProgress; sets started_at (Feature 16b). */
  startVisit(id: string, startedAt: Date): Promise<Visit>;
  /** InProgress -> AwaitingResults, releasing the room (Feature 17b). */
  holdForResults(id: string): Promise<Visit>;
  /** Called -> NoShow (only when called_count already >= 3 — checked by the use case; Feature 16 A1). */
  markNoShow(id: string): Promise<Visit>;
  completeVisit(id: string, completedAt: Date): Promise<Visit>;
  /**
   * End-of-day cleanup (Feature: auto-cancel): visits still WAITING/CALLED/
   * IN_PROGRESS/AWAITING_RESULTS whose appointment's appointmentTime is
   * before `cutoff` never reached COMPLETED — cancel them. Returns the
   * number cancelled.
   */
  cancelStaleBefore(cutoff: Date): Promise<number>;
  hasIncompleteClsOrders(visitId: string): Promise<boolean>;
  upsertVitalSigns(visitId: string, data: VitalSignsData): Promise<VitalSignsRecord>;
  getVitalSigns(visitId: string): Promise<VitalSignsRecord | null>;
  createExaminationResult(data: CreateExaminationResultData): Promise<ExaminationResult>;
  updateExaminationResult(visitId: string, data: UpdateExaminationResultData): Promise<void>;
  findResultWithDetails(visitId: string): Promise<ExaminationResultWithVisit | null>;
  findResultByAccessCode(accessCode: string): Promise<ExaminationResultWithVisit | null>;
  /**
   * Feature 89 — exam results whose follow_up_date (date-only column) falls
   * on one of the given target dates. The daily batch job passes [today,
   * today+3days] to cover both the "đúng ngày" and "nhắc trước 3 ngày"
   * reminder occasions in one query.
   */
  findRecheckCandidates(targetDates: Date[]): Promise<RecheckCandidate[]>;
}
