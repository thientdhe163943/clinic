import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { RequestWithTrace } from './request-id.interceptor';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.log(request, Date.now() - startedAt),
        error: () => this.log(request, Date.now() - startedAt),
      }),
    );
  }

  private log(request: RequestWithTrace, durationMs: number): void {
    this.logger.log(
      `${request.method} ${request.originalUrl ?? request.url} ${durationMs}ms traceId=${request.traceId}`,
    );
  }
}
