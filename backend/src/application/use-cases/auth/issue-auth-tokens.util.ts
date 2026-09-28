import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { User } from '../../../domain/entities/user.entity';
import { RefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository';
import { hashRefreshToken } from './token-hash.util';

export interface IssueRefreshTokenInput {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function signAccessToken(jwtService: JwtService, user: User): string {
  return jwtService.sign({ sub: user.id, email: user.email, role: user.role });
}

export async function issueRefreshToken(
  refreshTokenRepository: RefreshTokenRepository,
  configService: ConfigService,
  userId: string,
  input: IssueRefreshTokenInput,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashRefreshToken(token);
  const refreshTokenExpiresDays = configService.get<number>('auth.refreshTokenExpiresDays') ?? 7;
  const expiresAt = new Date(Date.now() + refreshTokenExpiresDays * 24 * 60 * 60 * 1000);

  await refreshTokenRepository.create({
    userId,
    tokenHash,
    deviceInfo: input.userAgent ?? null,
    ipAddress: input.ipAddress ?? null,
    expiresAt,
  });

  return token;
}
