import { Inject, Injectable } from '@nestjs/common';
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../../domain/repositories/notification.repository';

@Injectable()
export class MarkNotificationReadUseCase {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepository: NotificationRepository,
  ) {}

  // Scoped to userId at the repository layer (updateMany where id+userId) —
  // a request for someone else's notification id silently matches zero
  // rows instead of leaking whether that id exists.
  async execute(id: string, userId: string): Promise<void> {
    await this.notificationRepository.markAsRead(id, userId);
  }
}
