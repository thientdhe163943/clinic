import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';

export type RequestWithTrace = Request & {
  traceId?: string;
  user?: Record<string, unknown>;
};

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    const response = context.switchToHttp().getResponse<Response>();
    const traceId = String(request.headers['x-request-id'] ?? randomUUID());

    request.traceId = traceId;
    response.setHeader('x-request-id', traceId);

    return next.handle();
  }
}
