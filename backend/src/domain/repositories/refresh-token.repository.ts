import { RefreshToken } from '../entities/refresh-token.entity';

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface CreateRefreshTokenData {
  userId: string;
  tokenHash: string;
  deviceInfo?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(data: CreateRefreshTokenData): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  revoke(id: string): Promise<void>;
  // Revoke every active refresh token for a user, e.g. after password
  // change/reset. `exceptId` keeps the current session's token alive.
  revokeAllForUser(userId: string, exceptId?: string): Promise<void>;
}
