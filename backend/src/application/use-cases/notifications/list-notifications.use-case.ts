import { Inject, Injectable } from '@nestjs/common';
import { NotificationResponseDto, toNotificationResponse } from '../../dtos/notifications/notification-response.dto';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../../domain/repositories/notification.repository';

const DEFAULT_LIMIT = 20;

export interface NotificationListResponseDto {
  items: NotificationResponseDto[];
  unreadCount: number;
}

@Injectable()
export class ListNotificationsUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepository: NotificationRepository,
  ) {}

  async execute(userId: string): Promise<NotificationListResponseDto> {
    const [items, unreadCount] = await Promise.all([
      this.notificationRepository.findByUserId(userId, DEFAULT_LIMIT),
      this.notificationRepository.countUnread(userId),
    ]);

    return {
      items: items.map(toNotificationResponse),
      unreadCount,
    };
  }
}
