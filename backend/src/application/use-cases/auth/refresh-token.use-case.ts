import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InvalidSessionError } from '../../errors/application-error';
import { issueRefreshToken, signAccessToken } from './issue-auth-tokens.util';
import { hashRefreshToken } from './token-hash.util';
import {
  REFRESH_TOKEN_REPOSITORY,
  RefreshTokenRepository,
} from '../../../domain/repositories/refresh-token.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { LoginResponseDto } from '../../dtos/auth/login-response.dto';

export interface RefreshTokenInput {
  refreshToken?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// Exchanges a still-valid refresh_token cookie for a new access/refresh pair
// once the short-lived access token has expired — the access-token-only
// checks in JwtAuthGuard/middleware would otherwise force a full re-login
// every JWT_EXPIRES_IN (15m by default), even with a week-long refresh token
// sitting unused in the cookie jar. Rotates the refresh token on every use
// (old one revoked, new one issued) so a stolen-but-unused token can't be
// replayed indefinitely — mirrors the revoke pattern LogoutUseCase already uses.
@Injectable()
export class RefreshTokenUseCase {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<LoginResponseDto> {
    if (!input.refreshToken) throw new InvalidSessionError();

    const stored = await this.refreshTokenRepository.findByTokenHash(hashRefreshToken(input.refreshToken));
    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new InvalidSessionError();
    }

    const user = await this.userRepository.findById(stored.userId);
    if (!user || !user.isActive) throw new InvalidSessionError();

    // Rotate: the presented token is single-use.
    await this.refreshTokenRepository.revoke(stored.id);

    const accessToken = signAccessToken(this.jwtService, user);
    const refreshToken = await issueRefreshToken(this.refreshTokenRepository, this.configService, user.id, input);

    return {
      accessToken,
      refreshToken,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}
