export type VisitStatus = 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'AWAITING_RESULTS' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED';
export type ClsOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface VitalSigns {
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
  recordedAt: string;
}

export interface UpsertVitalSignsRequest {
  systolicBp?: number;
  diastolicBp?: number;
  heartRate?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
  height?: number;
}

// ─── Visit ──────────────────────────────────────────────────────────────────

export interface VisitListItem {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  roomId: string;
  queueNumber: string;
  priority: import('./appointments').VisitPriority;
  status: VisitStatus;
  serviceName: string;
  appointmentTime: string;
  calledAt: string | null;
  calledCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  // Ghi chú/lý do khám lễ tân nhập lúc tạo lịch hẹn.
  note: string | null;
}

export type ShiftType = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';

export interface VisitQuery {
  date?: string;
  status?: VisitStatus;
  doctorId?: string;
  // Explicit Sáng/Chiều/Cả ngày override — otherwise the backend derives
  // whichever shift covers the current time.
  shift?: ShiftType;
}

export interface NurseQueueResponse {
  shift: ShiftType | null;
  roomId: string | null;
  roomName: string | null;
  visits: VisitListItem[];
}

// Which room the caller is currently staffing — used by the doctor's queue
// header/empty-state (nurses get this inline via NurseQueueResponse).
export interface VisitQueueContext {
  shift: ShiftType | null;
  roomId: string | null;
  roomName: string | null;
}

// ─── CLS Order ───────────────────────────────────────────────────────────────

export interface ClsOrder {
  id: string;
  visitId: string;
  clsRoomId: string;
  clsRoomName: string;
  clsRoomCategory: string | null;
  serviceId: string;
  serviceName: string;
  patientName: string;
  patientCode: string;
  dateOfBirth: string | null;
  gender: string;
  doctorName: string;
  appointmentTime: string;
  note: string | null;
  status: ClsOrderStatus;
  calledAt: string | null;
  createdAt: string;
  resultSummary: string | null;
  resultRows: { name: string; result: string; unit?: string; normalRange?: string; note?: string }[] | null;
  resultFindings: string | null;
}

export interface CreateClsOrderRequest {
  visitId: string;
  clsRoomId: string;
  serviceId: string;
  note?: string;
}

// ─── Examination Result ───────────────────────────────────────────────────────

export interface ClsResultSummary {
  serviceName: string;
  clsRoomCategory: string | null;
  summary: string | null;
  resultRows: { name: string; result: string; unit?: string; normalRange?: string; note?: string }[] | null;
  resultFindings: string | null;
}

export interface ExaminationResult {
  id: string;
  visitId: string;
  patientName: string;
  patientCode: string;
  patientDateOfBirth: string | null;
  patientGender: string;
  patientAddress: string | null;
  doctorName: string;
  serviceName: string;
  appointmentTime: string;
  diagnosis: string;
  clinicalNote: string | null;
  treatmentResult: string | null;
  followUpDate: string | null;
  accessCode: string;
  accessCodeExpiresAt: string | null;
  clsSummaries: ClsResultSummary[];
  createdAt: string;
}

export interface CreateExaminationResultRequest {
  diagnosis: string;
  clinicalNote?: string;
  treatmentResult?: string;
  followUpDate?: string;
}

// ─── Prescription ─────────────────────────────────────────────────────────────

export interface PrescriptionItem {
  id: string;
  medicineId: string;
  medicineName: string;
  activeIngredient: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instruction: string | null;
  allergyWarning: boolean;
  interactionWarning: boolean;
  sortOrder: number;
}

export interface Prescription {
  id: string;
  visitId: string;
  note: string | null;
  createdAt: string;
  items: PrescriptionItem[];
}

export interface CreatePrescriptionItemRequest {
  medicineId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instruction?: string;
}

export interface CreatePrescriptionRequest {
  visitId: string;
  note?: string;
  items: CreatePrescriptionItemRequest[];
}

export interface UpdatePrescriptionRequest {
  note?: string;
  items: CreatePrescriptionItemRequest[];
}

// ─── Medicine ────────────────────────────────────────────────────────────────

export interface Medicine {
  id: string;
  name: string;
  activeIngredient: string;
  dosageForm: string;
  unit: string;
  price: number | null;
}
