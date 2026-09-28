import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DEFAULT_LOCALE, MESSAGE_CATALOG_PORT, MessageCatalogPort } from '../../application/ports/message-catalog.port';
import { MessageCode } from '../../domain/value-objects/message-code.vo';
import { MSG_CODE_KEY } from '../decorators/msg-code.decorator';
import { ApiResponse } from '../response/api-response';
import { RequestWithTrace } from './request-id.interceptor';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  constructor(
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithTrace>();
    const msgCode = this.reflector.getAllAndOverride<MessageCode | undefined>(MSG_CODE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'success' in data) {
          return { ...data, traceId: request.traceId ?? data.traceId };
        }

        const message = msgCode
          ? this.messageCatalog.getMessage(msgCode, DEFAULT_LOCALE)
          : 'OK';

        return ApiResponse.ok(data, message, { traceId: request.traceId });
      }),
    );
  }
}
