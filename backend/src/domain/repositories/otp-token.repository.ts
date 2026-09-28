import { OtpToken } from '../entities/otp-token.entity';
import { OtpPurpose } from '../enums/otp-purpose.enum';

export const OTP_TOKEN_REPOSITORY = Symbol('OTP_TOKEN_REPOSITORY');

export interface CreateOtpTokenData {
  userId: string;
  otpCode: string;
  purpose: OtpPurpose;
  expiresAt: Date;
}

export interface OtpTokenRepository {
  create(data: CreateOtpTokenData): Promise<OtpToken>;
  // Finds an unused, unexpired OTP matching the given code for the user/purpose.
  findActiveByCode(userId: string, purpose: OtpPurpose, otpCode: string): Promise<OtpToken | null>;
  markUsed(id: string): Promise<void>;
  // Invalidates every previously issued OTP for the user/purpose, e.g.
  // when a new OTP is requested.
  invalidateAllForUser(userId: string, purpose: OtpPurpose): Promise<void>;
}
