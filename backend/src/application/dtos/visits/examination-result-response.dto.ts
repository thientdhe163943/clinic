export interface ClsResultSummary {
  serviceName: string;
  clsRoomCategory: string | null;
  summary: string | null;
  resultRows: { name: string; result: string; unit?: string; normalRange?: string; note?: string }[] | null;
  resultFindings: string | null;
}

export interface ExaminationResultResponseDto {
  id: string;
  visitId: string;
  patientName: string;
  patientCode: string;
  patientDateOfBirth: Date | null;
  patientGender: string;
  patientAddress: string | null;
  doctorName: string;
  serviceName: string;
  appointmentTime: Date;
  diagnosis: string;
  clinicalNote: string | null;
  treatmentResult: string | null;
  followUpDate: Date | null;
  accessCode: string;
  accessCodeExpiresAt: Date | null;
  clsSummaries: ClsResultSummary[];
  createdAt: Date;
}
