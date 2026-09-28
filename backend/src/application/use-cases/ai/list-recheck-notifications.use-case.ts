import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta, PaginationDto } from '../../dtos/pagination.dto';
import { RecheckNotificationListResponseDto } from '../../dtos/ai/recheck-notification-response.dto';
import { NOTIFICATION_REPOSITORY, NotificationRepository } from '../../../domain/repositories/notification.repository';
import { RECHECK_REMINDER_TYPE } from './run-recheck-reminder.use-case';

@Injectable()
export class ListRecheckNotificationsUseCase {
  constructor(@Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepository: NotificationRepository) {}

  async execute(query: PaginationDto): Promise<RecheckNotificationListResponseDto> {
    const { items, total } = await this.notificationRepository.findByType(RECHECK_REMINDER_TYPE, query.page, query.limit);

    return {
      items: items.map((item) => ({
        id: item.id,
        recipient: item.recipient,
        channel: item.channel,
        status: item.status,
        body: item.body,
        sentAt: item.sentAt ? item.sentAt.toISOString() : null,
        visitId: item.refId,
        createdAt: item.createdAt.toISOString(),
      })),
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }
}
