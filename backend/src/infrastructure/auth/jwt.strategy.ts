import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../presentation/guards/authenticated-user.type';
import { ACCESS_TOKEN_COOKIE } from './cookie.util';

// Reads the access token from the httpOnly cookie set on login. Falls back to the
// Authorization: Bearer header for non-browser clients (Swagger, Postman, mobile).
function fromAccessTokenCookie(req: Request): string | null {
  return (req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined) ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([fromAccessTokenCookie, ExtractJwt.fromAuthHeaderAsBearerToken()]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret') as string,
    });
  }

  // Whitelist the JWT claims that are attached to `request.user` — never
  // pass through the raw payload in case extra/legacy claims are present.
  validate(payload: AuthenticatedUser): AuthenticatedUser {
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
