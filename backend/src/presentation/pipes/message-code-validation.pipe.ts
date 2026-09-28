import { BadRequestException, Inject, Injectable, ValidationError, ValidationPipe } from '@nestjs/common';
import { MESSAGE_CATALOG_PORT, MessageCatalogPort } from '../../application/ports/message-catalog.port';
import { MSG } from '../../domain/value-objects/message-code.vo';

const MSG_CODE_RE = /^MSG_(INFO|WARN|ERR)_\d{4}$/;

// Replaces main.ts's plain `new ValidationPipe(...)` (which wasn't built by
// Nest DI, so couldn't inject anything) with a DI-registered one that
// resolves any class-validator `message: MSG.ERR_0XXX` constraint through
// the message catalog before it reaches the client — the same job
// GlobalExceptionFilter does for ApplicationError, but for DTO validation.
// class-validator itself runs synchronously with no DB/DI access at
// decorator-declaration time, but since MessageCatalogPort's cache is
// already fully in-memory (see PrismaMessageCatalogRepository), resolving
// synchronously here needs no I/O.
@Injectable()
export class MessageCodeValidationPipe extends ValidationPipe {
  constructor(@Inject(MESSAGE_CATALOG_PORT) messageCatalog: MessageCatalogPort) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      // Shape matches AppExceptionBody (app.exception.ts) so
      // GlobalExceptionFilter handles it identically to any other thrown
      // exception — it re-resolves the top-level message from `code` itself,
      // `details` carries the per-field messages.
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException({
          code: MSG.ERR_0006,
          details: resolveMessages(errors, messageCatalog),
        }),
    });
  }
}

// Walks errors[].constraints + errors[].children recursively — a nested DTO
// (e.g. an array of line items) reports failures on `children`, not flat
// `constraints`, so a shallow pass would silently drop those messages.
function resolveMessages(errors: ValidationError[], messageCatalog: MessageCatalogPort): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    for (const rawMessage of Object.values(error.constraints ?? {})) {
      messages.push(MSG_CODE_RE.test(rawMessage) ? messageCatalog.getMessage(rawMessage) : rawMessage);
    }
    if (error.children?.length) {
      messages.push(...resolveMessages(error.children, messageCatalog));
    }
  }

  return messages;
}
