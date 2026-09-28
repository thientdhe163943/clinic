import { Notification } from '../../../domain/entities/notification.entity';

export interface NotificationResponseDto {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  refId: string | null;
  isRead: boolean;
  createdAt: Date;
}

export function toNotificationResponse(notification: Notification): NotificationResponseDto {
  return {
    id: notification.id,
    type: notification.type,
    subject: notification.subject,
    body: notification.body,
    refId: notification.refId,
    isRead: notification.isRead,
    createdAt: notification.createdAt,
  };
}
