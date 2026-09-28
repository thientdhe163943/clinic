export class MedicalRecord {
  constructor(
    public readonly id: string,
    public readonly patientId: string,
    public readonly medicalHistory: string | null,
    public readonly clinicalNote: string | null,
    public readonly diagnosisSummary: string | null,
    public readonly treatmentSummary: string | null,
    public readonly followUpNote: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly createdBy: string,
    public readonly updatedBy: string | null,
  ) {}
}
