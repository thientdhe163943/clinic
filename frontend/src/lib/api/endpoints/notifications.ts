import { apiClient, unwrap, unwrapResult } from '../client';
import type { NotificationListResponse } from '@/types/notifications';

export const notificationsApi = {
  list() {
    return unwrap<NotificationListResponse>(apiClient.get('/notifications'));
  },

  markRead(id: string) {
    return unwrapResult<null>(apiClient.patch(`/notifications/${id}/read`));
  },

  markAllRead() {
    return unwrapResult<null>(apiClient.patch('/notifications/read-all'));
  },
};
