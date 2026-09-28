import { OtpPurpose } from '../enums/otp-purpose.enum';

export class OtpToken {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly otpCode: string,
    public readonly purpose: OtpPurpose,
    public readonly expiresAt: Date,
    public readonly usedAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
