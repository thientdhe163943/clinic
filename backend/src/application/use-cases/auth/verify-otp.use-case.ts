import { Inject, Injectable } from '@nestjs/common';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';
import { OTP_TOKEN_REPOSITORY, OtpTokenRepository } from '../../../domain/repositories/otp-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { InvalidOtpError } from '../../errors/application-error';

export interface VerifyOtpInput {
  username: string;
  otpCode: string;
}

@Injectable()
export class VerifyOtpUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(OTP_TOKEN_REPOSITORY) private readonly otpTokenRepository: OtpTokenRepository,
  ) {}

  // Checks whether the OTP is valid without consuming it — the actual
  // password reset step is responsible for marking it as used. Email-only
  // lookup — see ForgotPasswordUseCase.
  async execute(input: VerifyOtpInput): Promise<void> {
    const user = await this.userRepository.findByEmail(input.username);
    if (!user) throw new InvalidOtpError();

    const otp = await this.otpTokenRepository.findActiveByCode(user.id, OtpPurpose.FORGOT_PASSWORD, input.otpCode);
    if (!otp) throw new InvalidOtpError();
  }
}
