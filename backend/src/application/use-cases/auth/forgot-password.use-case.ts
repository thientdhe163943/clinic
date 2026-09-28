import { Inject, Injectable } from '@nestjs/common';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';
import { OTP_TOKEN_REPOSITORY, OtpTokenRepository } from '../../../domain/repositories/otp-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { ResourceNotFoundError } from '../../errors/application-error';
import { EMAIL_PORT, EmailPort } from '../../ports/email.port';
import { generateOtpCode, OTP_TTL_MINUTES } from './otp.util';

export interface ForgotPasswordInput {
  username: string;
}

export interface ForgotPasswordResult {
  email: string;
}

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(OTP_TOKEN_REPOSITORY) private readonly otpTokenRepository: OtpTokenRepository,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
  ) {}

  // Email-only lookup (2026-08-07) — this used to also accept a phone
  // number via findByEmailOrPhone, but OTP delivery is email-only (SMS was
  // removed), so a phone-matched account with no email was always a dead
  // end. ForgotPasswordRequestDto's @IsEmail() means `input.username` is
  // already guaranteed to be email-shaped by the time it reaches here.
  async execute(input: ForgotPasswordInput): Promise<ForgotPasswordResult> {
    const user = await this.userRepository.findByEmail(input.username);
    if (!user) throw new ResourceNotFoundError('User');

    const otpCode = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // A new OTP request invalidates every previously issued OTP for this purpose.
    await this.otpTokenRepository.invalidateAllForUser(user.id, OtpPurpose.FORGOT_PASSWORD);
    await this.otpTokenRepository.create({
      userId: user.id,
      otpCode,
      purpose: OtpPurpose.FORGOT_PASSWORD,
      expiresAt,
    });

    await this.emailPort.send({
      to: input.username,
      subject: 'Mã OTP đặt lại mật khẩu',
      body: `Mã OTP của bạn là ${otpCode}. Mã có hiệu lực trong ${OTP_TTL_MINUTES} phút.`,
    });

    return { email: input.username };
  }
}
