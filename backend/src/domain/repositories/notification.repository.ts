import { Notification } from '../entities/notification.entity';

export const NOTIFICATION_REPOSITORY = Symbol('NOTIFICATION_REPOSITORY');

export interface NotificationRepository {
  /** Newest first, capped at `limit` (default 20 in the use case). */
  findByUserId(userId: string, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  /** No-op (does not throw) if the notification doesn't belong to userId — see MarkNotificationReadUseCase. */
  markAsRead(id: string, userId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  /** Feature 89 — all notification_logs rows of a given type, newest first,
   * across every patient (staff-facing listing, not scoped to one userId). */
  findByType(type: string, page: number, limit: number): Promise<{ items: Notification[]; total: number }>;
}
