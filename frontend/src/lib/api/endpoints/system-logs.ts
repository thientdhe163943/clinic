import { apiClient, unwrap } from '../client';
import type { ListSystemLogsQuery, ListSystemLogsResponse } from '@/types/system-logs';

// Feature 82 — System Log Management. Read-only; route ADMIN only.
export const systemLogsApi = {
  list(query: ListSystemLogsQuery = {}) {
    const params: Record<string, string | number> = {};
    if (query.userId) params.userId = query.userId;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    if (query.action) params.action = query.action;
    if (query.module) params.module = query.module;
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;
    return unwrap<ListSystemLogsResponse>(apiClient.get('/admin/logs', { params }));
  },
};
