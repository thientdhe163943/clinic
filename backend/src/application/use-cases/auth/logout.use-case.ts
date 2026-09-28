import { Inject, Injectable } from '@nestjs/common';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { hashRefreshToken } from './token-hash.util';

export interface LogoutInput {
  userId: string;
  refreshToken?: string;
}

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const token = input.refreshToken
      ? await this.refreshTokenRepository.findByTokenHash(hashRefreshToken(input.refreshToken))
      : null;

    // Logout is idempotent: an already-revoked or unknown token still succeeds.
    if (token && token.userId === input.userId && !token.revokedAt) {
      await this.refreshTokenRepository.revoke(token.id);
    }

    await this.auditLog.write({
      userId: input.userId,
      action: 'LOGOUT',
      module: 'AUTH',
    });
  }
}
