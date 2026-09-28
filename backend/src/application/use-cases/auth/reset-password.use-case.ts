import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import { PasswordPolicy } from '../../../domain/value-objects/password-policy.vo';
import { OTP_TOKEN_REPOSITORY, OtpTokenRepository } from '../../../domain/repositories/otp-token.repository';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { ApplicationError, InvalidOtpError, SamePasswordError, WeakPasswordError } from '../../errors/application-error';

const BCRYPT_ROUNDS = 10;

export interface ResetPasswordInput {
  username: string;
  otpCode: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(OTP_TOKEN_REPOSITORY) private readonly otpTokenRepository: OtpTokenRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    if (input.newPassword !== input.confirmPassword) {
      throw new ApplicationError(MSG.ERR_0006, 400);
    }

    if (!PasswordPolicy.isStrong(input.newPassword)) throw new WeakPasswordError();

    // Email-only lookup — see ForgotPasswordUseCase.
    const user = await this.userRepository.findByEmail(input.username);
    if (!user) throw new InvalidOtpError();

    const otp = await this.otpTokenRepository.findActiveByCode(user.id, OtpPurpose.FORGOT_PASSWORD, input.otpCode);
    if (!otp) throw new InvalidOtpError();

    const isSamePassword = await bcrypt.compare(input.newPassword, user.passwordHash);
    if (isSamePassword) throw new SamePasswordError();

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await this.userRepository.update(user.id, {
      passwordHash,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedAt: null,
    });
    await this.otpTokenRepository.markUsed(otp.id);

    // Reset invalidates every existing session.
    await this.refreshTokenRepository.revokeAllForUser(user.id);
  }
}
