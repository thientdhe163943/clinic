import type { ClsRoomCategory } from './rooms';

export type ClsOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface ClsResultAttachment {
  fileName: string;
  fileUrl: string;
}

// One row of a structured lab-test result — only meaningful when
// clsRoomCategory is LAB; X-quang/Siêu âm rooms just use free-text summary.
export interface LabResultRow {
  name: string;
  result: string;
  unit?: string;
  normalRange?: string;
  note?: string;
}

export interface ClsOrder {
  id: string;
  visitId: string;
  clsRoomId: string;
  clsRoomName: string;
  clsRoomCategory: ClsRoomCategory | null;
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
  resultAttachments: ClsResultAttachment[];
  resultRows: LabResultRow[] | null;
  // Descriptive findings ("KẾT QUẢ") — only meaningful for XRAY/ULTRASOUND,
  // shown apart from the "KL" conclusion in resultSummary.
  resultFindings: string | null;
}

export interface ClsOrderFilter {
  statuses?: ClsOrderStatus[];
}

export interface LabQueueResponse {
  clsRoomId: string | null;
  clsRoomName: string | null;
  orders: ClsOrder[];
}

export interface EnterClsResultRequest {
  summary: string;
  rows?: LabResultRow[];
  findings?: string;
  // false/omitted: save progress, order stays IN_PROGRESS and editable.
  // true: same save, plus lock the order into COMPLETED — no further saves
  // are accepted afterward.
  finalize?: boolean;
}

// version-up 0.2 Phase 3 — OCR pre-fill draft for LAB result entry
// (POST :id/ocr-extract). Nothing is persisted by this call: the KTV
// reviews/edits the rows in the existing hand-entry table, then saves them
// through the unchanged PATCH :id/result flow.
export interface OcrExtractRow {
  name: string;
  result: string;
  unit?: string;
}

export interface OcrExtractResponse {
  rawText: string;
  rows: OcrExtractRow[];
}
