export class ExaminationResult {
  constructor(
    public readonly id: string,
    public readonly visitId: string,
    public readonly diagnosis: string,
    public readonly clinicalNote: string | null,
    public readonly treatmentResult: string | null,
    public readonly followUpDate: Date | null,
    public readonly accessCode: string,
    public readonly accessCodeExpiresAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly createdBy: string,
    public readonly updatedBy: string | null,
  ) {}
}
