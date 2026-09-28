import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { ApplicationError } from '../../application/errors/application-error';
import {
  DEFAULT_LOCALE,
  MESSAGE_CATALOG_PORT,
  MessageCatalogPort,
} from '../../application/ports/message-catalog.port';
import { MSG, MessageCode } from '../../domain/value-objects/message-code.vo';
import { RequestWithTrace } from '../interceptors/request-id.interceptor';
import { ApiResponse } from '../response/api-response';
import { AppExceptionBody } from './app.exception';

interface NormalizedException {
  status: number;
  code: MessageCode;
  params?: Record<string, string | number>;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    @Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithTrace>();
    const response = context.getResponse<Response>();
    const normalized = this.normalizeException(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl ?? request.url} traceId=${request.traceId}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const message = this.messageCatalog.getMessage(normalized.code, DEFAULT_LOCALE, normalized.params);

    const body = ApiResponse.fail(message, {
      code: normalized.code,
      traceId: request.traceId,
    });

    response.status(normalized.status).json({ ...body, details: normalized.details });
  }

  private normalizeException(exception: unknown): NormalizedException {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();

      // AppException already carries a MessageCode + params, use it as-is.
      if (typeof response === 'object' && response !== null && 'code' in response) {
        const body = response as Partial<AppExceptionBody>;
        return {
          status,
          code: (body.code as MessageCode) ?? this.defaultCodeForStatus(status),
          params: body.params,
          details: body.details,
        };
      }

      // Plain Nest exceptions (e.g. ValidationPipe's BadRequestException) carry
      // a string/array `message` — keep it as `details` and map a generic code
      // from the HTTP status so the response is still translated.
      const message = typeof response === 'string' ? response : (response as Record<string, unknown>).message;

      return {
        status,
        code: this.defaultCodeForStatus(status),
        details: Array.isArray(message) ? message : undefined,
      };
    }

    if (exception instanceof ApplicationError) {
      return {
        status: exception.statusCode,
        code: exception.code,
        params: exception.params,
        details: exception.details,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        // Genuinely a duplicate-key conflict (MSG_ERR_0010's actual intended
        // meaning) — unlike the many use-case-level state-conflict errors
        // that used to misuse this same code, this one doesn't know a
        // specific resource label at this generic a catch point.
        return {
          status: HttpStatus.CONFLICT,
          code: MSG.ERR_0010,
          params: { resource: 'Dữ liệu' },
          details: exception.meta,
        };
      }

      if (exception.code === 'P2025') {
        return { status: HttpStatus.NOT_FOUND, code: MSG.ERR_0009, params: { resource: 'Dữ liệu' } };
      }
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, code: MSG.ERR_0011 };
  }

  private defaultCodeForStatus(status: number): MessageCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return MSG.ERR_0007;
      case HttpStatus.FORBIDDEN:
        return MSG.ERR_0008;
      case HttpStatus.NOT_FOUND:
        return MSG.ERR_0009;
      case HttpStatus.CONFLICT:
        return MSG.ERR_0010;
      case HttpStatus.TOO_MANY_REQUESTS:
        // Generic 429 fallback — ThrottlerGuard is global (app.module.ts),
        // so this fires for any endpoint, not just /ai/chat. The AI routes
        // throw AiRateLimitExceededError (MSG.ERR_0094) before this is ever
        // reached — see AiThrottlerGuard.
        return MSG.ERR_0095;
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return MSG.ERR_0011;
      default:
        return MSG.ERR_0006;
    }
  }
}
