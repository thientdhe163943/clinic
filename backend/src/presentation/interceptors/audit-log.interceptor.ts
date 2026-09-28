import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../application/ports/audit-log.port';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';
import { RequestWithTrace } from './request-id.interceptor';

const METHOD_ACTION_MAP: Record<string, string> = {
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUDIT_LOG_PORT)
    private readonly auditLogPort: AuditLogPort,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipAudit = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    const action = METHOD_ACTION_MAP[request.method];

    if (skipAudit || !action) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const user = request.user as AuthenticatedUser | undefined;
        void this.auditLogPort.write({
          userId: user?.sub ?? null,
          action,
          module: this.resolveModule(request),
          detail: { path: request.originalUrl ?? request.url, traceId: request.traceId },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
      }),
    );
  }

  private resolveModule(request: RequestWithTrace): string {
    const path = request.path ?? request.url;
    const segments = path.split('/').filter(Boolean);

    if (segments[0] === 'api' && /^v\d+$/i.test(segments[1] ?? '')) {
      return segments[2]?.toUpperCase() ?? 'SYSTEM';
    }

    return segments[0]?.toUpperCase() ?? 'SYSTEM';
  }
}
