import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Request } from 'express';
import { BookingRateLimitExceededError } from '../../application/errors/application-error';
import { UserRole } from '../../domain/enums/user-role.enum';
import { AuthenticatedUser } from './authenticated-user.type';

// Version-up 0.2 plan item #7 "Chống spam đặt lịch", proposal 1 — dedicated
// named throttlers for the booking endpoints, independent of the app-wide
// 'default' one (app.module.ts), following the same pattern already
// established by AiThrottlerGuard (see ai-throttler.guard.ts) so hitting
// either limit reports the booking-specific MSG.ERR_0138 instead of the
// generic 429 fallback.
//
// NOTE (deviation from AiThrottlerGuard): ThrottlerGuard.onModuleInit()
// unconditionally rebuilds `this.throttlers` from the app-wide injected
// `options` token (`ThrottlerModule.forRoot(...)` in app.module.ts), which
// would silently clobber a custom array assigned only in the constructor if
// that lifecycle hook ever runs on this instance. Overriding onModuleInit
// here to re-apply the custom throttler *after* calling super makes the
// per-endpoint limit correct regardless of whether Nest ends up invoking
// this hook for a guard that's referenced via @UseGuards() rather than
// listed in a module's own `providers` array.

// POST /appointments/guest, /appointments/guest/otp, /appointments/guest/confirm
// — unauthenticated (@Public()), tracked per caller IP (ThrottlerGuard's
// default getTracker()), same as AiThrottlerGuard.
@Injectable()
export class GuestBookingThrottlerGuard extends ThrottlerGuard {
  private readonly guestThrottler: { name: string; ttl: number; limit: number };

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.guestThrottler = {
      name: 'guest-booking',
      ttl: this.configService.get<number>('booking.guestRateLimitTtlMs') ?? 3_600_000,
      limit: this.configService.get<number>('booking.guestRateLimit') ?? 5,
    };
    this.throttlers = [this.guestThrottler];
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = [this.guestThrottler];
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new BookingRateLimitExceededError();
  }
}

// POST /appointments — tracked per logged-in user (not IP), and only applies
// to a PATIENT self-booking; a RECEPTIONIST creating walk-in appointments on
// this same endpoint routinely exceeds 10/hour during busy periods and must
// not be throttled (this guard runs after the global JwtAuthGuard, see
// app.module.ts's APP_GUARD ordering, so req.user is already populated here).
@Injectable()
export class PatientBookingThrottlerGuard extends ThrottlerGuard {
  private readonly patientThrottler: {
    name: string;
    ttl: number;
    limit: number;
    skipIf: (context: ExecutionContext) => boolean;
  };

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.patientThrottler = {
      name: 'patient-booking',
      ttl: this.configService.get<number>('booking.patientRateLimitTtlMs') ?? 3_600_000,
      limit: this.configService.get<number>('booking.patientRateLimit') ?? 10,
      skipIf: (context: ExecutionContext) => {
        const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
        return req.user?.role !== UserRole.PATIENT;
      },
    };
    this.throttlers = [this.patientThrottler];
  }

  async onModuleInit(): Promise<void> {
    await super.onModuleInit();
    this.throttlers = [this.patientThrottler];
  }

  protected async getTracker(req: Request & { user?: AuthenticatedUser }): Promise<string> {
    return req.user?.sub ?? req.ip ?? 'unknown';
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new BookingRateLimitExceededError();
  }
}
