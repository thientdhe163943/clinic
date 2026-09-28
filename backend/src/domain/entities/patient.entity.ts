import { Gender } from '../enums/gender.enum';

export class Patient {
  constructor(
    public readonly id: string,
    public readonly patientCode: string,
    public readonly fullName: string,
    public readonly email: string | null,
    public readonly dateOfBirth: Date,
    public readonly gender: Gender,
    public readonly phone: string,
    public readonly idCard: string,
    public readonly address: string | null,
    public readonly note: string | null,
    public readonly notificationConsent: boolean,
    public readonly userId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
