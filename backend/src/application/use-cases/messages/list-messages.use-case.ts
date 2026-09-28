import { Inject, Injectable } from '@nestjs/common';
import { MESSAGE_CATALOG_PORT, MessageCatalogPort } from '../../ports/message-catalog.port';
import { MessageResponseDto } from '../../dtos/messages/message-response.dto';

// Feeds the frontend's client-side validation catalog (see message-system
// plan Phase 5) — the whole default-locale catalog in one call, since the
// frontend caches it long-lived rather than fetching per code.
@Injectable()
export class ListMessagesUseCase {
  constructor(@Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort) {}

  execute(): MessageResponseDto[] {
    return this.messageCatalog.getAll().map((row) => ({
      messageCode: row.code,
      locale: 'vi',
      message: row.message,
    }));
  }
}
