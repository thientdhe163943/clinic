import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { GetMessageUseCase } from '../../application/use-cases/messages/get-message.use-case';
import { ListMessagesUseCase } from '../../application/use-cases/messages/list-messages.use-case';
import { ReloadMessagesUseCase } from '../../application/use-cases/messages/reload-messages.use-case';
import { DEFAULT_LOCALE } from '../../application/ports/message-catalog.port';
import { UserRole } from '../../domain/enums/user-role.enum';
import { Public } from '../decorators/public.decorator';
import { Roles } from '../decorators/roles.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';

@SkipAudit()
@Controller('messages')
export class MessagesController {
  constructor(
    private readonly getMessageUseCase: GetMessageUseCase,
    private readonly listMessagesUseCase: ListMessagesUseCase,
    private readonly reloadMessagesUseCase: ReloadMessagesUseCase,
  ) {}

  // Whole default-locale catalog, for the frontend's client-side validation
  // cache (see message-system plan Phase 5) — fetched once, cached long-lived.
  @Public()
  @Get()
  findAll() {
    return this.listMessagesUseCase.execute();
  }

  @Public()
  @Get(':code')
  findOne(@Param('code') code: string, @Query('locale') locale?: string) {
    return this.getMessageUseCase.execute(code, locale ?? DEFAULT_LOCALE);
  }

  // ADMIN-only: re-reads app_messages from the DB into the in-memory cache
  // (PrismaMessageCatalogRepository) after editing rows directly in the DB,
  // without needing a full app restart/redeploy.
  @Roles(UserRole.ADMIN)
  @Post('reload')
  async reload() {
    await this.reloadMessagesUseCase.execute();
    return { reloaded: true };
  }
}
