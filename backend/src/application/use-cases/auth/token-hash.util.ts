import * as crypto from 'crypto';

// Refresh tokens are stored hashed (never in plaintext) but must remain
// lookup-able by exact match, so a deterministic digest is used instead of bcrypt.
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
