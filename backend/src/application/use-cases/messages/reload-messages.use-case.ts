import { Inject, Injectable } from '@nestjs/common';
import { MESSAGE_CATALOG_PORT, MessageCatalogPort } from '../../ports/message-catalog.port';

@Injectable()
export class ReloadMessagesUseCase {
  constructor(@Inject(MESSAGE_CATALOG_PORT) private readonly messageCatalog: MessageCatalogPort) {}

  execute(): Promise<void> {
    return this.messageCatalog.reload();
  }
}
