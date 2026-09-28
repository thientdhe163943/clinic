'use client';

import { useQuery } from '@tanstack/react-query';
import { publicServicesApi } from '@/lib/api/endpoints/public-services';
import type { ListPublicServicesQuery } from '@/types/public-services';

export function usePublicServices(params?: ListPublicServicesQuery, enabled = true) {
  return useQuery({
    queryKey: ['public-services', params],
    queryFn: () => publicServicesApi.list(params),
    enabled,
  });
}
