import { Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const MS_PER_UNIT: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// Parses durations like "15m", "7d", "30s" (the same format used by JWT_EXPIRES_IN) into milliseconds.
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) return Number(value) || 0;

  const [, amount, unit] = match;
  return unit === 'ms' ? Number(amount) : Number(amount) * MS_PER_UNIT[unit];
}

interface AuthCookieOptions {
  accessTokenMaxAgeMs: number;
  refreshTokenMaxAgeMs: number;
  secure: boolean;
}

// Persists access/refresh tokens as httpOnly cookies so they are never exposed to
// page JavaScript (mitigates token theft via XSS). SameSite=lax keeps them usable
// across the FE (3000) <-> BE (3001) localhost ports, which share the same site.
export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  options: AuthCookieOptions,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
    maxAge: options.accessTokenMaxAgeMs,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.secure,
    path: '/',
    maxAge: options.refreshTokenMaxAgeMs,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/' });
}
