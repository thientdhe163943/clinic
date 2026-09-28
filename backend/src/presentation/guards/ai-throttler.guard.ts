import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { AiRateLimitExceededError } from '../../application/errors/application-error';

// Feature 83 business rule: "Rate limit: tối đa 20 request/phút/user" (see
// ai.controller.ts for the no-auth-tracking-infra note on tracking by IP).
export const AI_CHAT_RATE_LIMIT = { name: 'ai', ttl: 60_000, limit: 20 };

// A dedicated named throttler ('ai'), independent of the app-wide 'default'
// one (app.module.ts) — this guard owns its own counter and, critically,
// its own throwThrottlingException(), so hitting this limit reports
// MSG.ERR_0094 ("Đã vượt giới hạn số lần gọi AI") instead of the generic
// 429 fallback the global ThrottlerGuard would otherwise report.
@Injectable()
export class AiThrottlerGuard extends ThrottlerGuard {
  constructor(options: ThrottlerModuleOptions, storageService: ThrottlerStorage, reflector: Reflector) {
    super(options, storageService, reflector);
    this.throttlers = [AI_CHAT_RATE_LIMIT];
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new AiRateLimitExceededError();
  }
}
