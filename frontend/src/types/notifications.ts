export interface AppNotification {
  id: string;
  type: string;
  subject: string | null;
  body: string;
  refId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  items: AppNotification[];
  unreadCount: number;
}
