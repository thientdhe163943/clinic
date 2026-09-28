'use client';

import { useQuery } from '@tanstack/react-query';
import { systemLogsApi } from '@/lib/api/endpoints/system-logs';
import type { ListSystemLogsQuery } from '@/types/system-logs';

export function useSystemLogs(query: ListSystemLogsQuery, enabled = true) {
  return useQuery({
    queryKey: ['system-logs', query],
    queryFn: () => systemLogsApi.list(query),
    enabled,
  });
}
