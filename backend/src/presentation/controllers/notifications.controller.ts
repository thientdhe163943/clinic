import { Controller, Get, Param, Patch } from '@nestjs/common';
import { ListNotificationsUseCase } from '../../application/use-cases/notifications/list-notifications.use-case';
import { MarkNotificationReadUseCase } from '../../application/use-cases/notifications/mark-notification-read.use-case';
import { MarkAllNotificationsReadUseCase } from '../../application/use-cases/notifications/mark-all-notifications-read.use-case';
import { MSG } from '../../domain/value-objects/message-code.vo';
import { CurrentUser } from '../decorators/current-user.decorator';
import { MsgCode } from '../decorators/msg-code.decorator';
import { AuthenticatedUser } from '../guards/authenticated-user.type';

// In-app notification bell — no @Roles restriction, any authenticated user
// sees only their own notifications (userId scoped at the use-case layer).
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.listNotificationsUseCase.execute(user.sub);
  }

  @Patch(':id/read')
  @MsgCode(MSG.INFO_0083)
  async markRead(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.markNotificationReadUseCase.execute(id, user.sub);
    return null;
  }

  @Patch('read-all')
  @MsgCode(MSG.INFO_0084)
  async markAllRead(@CurrentUser() user: AuthenticatedUser) {
    await this.markAllNotificationsReadUseCase.execute(user.sub);
    return null;
  }
}
