import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PasswordPolicy } from '../../../domain/value-objects/password-policy.vo';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import {
  IncorrectCurrentPasswordError,
  PasswordMismatchError,
  ResourceNotFoundError,
  SamePasswordError,
  WeakPasswordError,
} from '../../errors/application-error';
import { hashRefreshToken } from './token-hash.util';

const BCRYPT_ROUNDS = 10;

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  refreshToken?: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
  ) {}

  async execute(input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new ResourceNotFoundError('User');

    const isCurrentPasswordValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) throw new IncorrectCurrentPasswordError();

    if (input.newPassword !== input.confirmPassword) {
      throw new PasswordMismatchError();
    }

    if (!PasswordPolicy.isStrong(input.newPassword)) throw new WeakPasswordError();

    const isSamePassword = await bcrypt.compare(input.newPassword, user.passwordHash);
    if (isSamePassword) throw new SamePasswordError();

    const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

    await this.userRepository.update(user.id, {
      passwordHash,
      mustChangePassword: false,
    });

    const currentTokenId = await this.resolveCurrentTokenId(input.refreshToken);
    await this.refreshTokenRepository.revokeAllForUser(user.id, currentTokenId);
  }

  private async resolveCurrentTokenId(refreshToken?: string): Promise<string | undefined> {
    if (!refreshToken) return undefined;

    const token = await this.refreshTokenRepository.findByTokenHash(hashRefreshToken(refreshToken));
    return token?.id;
  }
}
