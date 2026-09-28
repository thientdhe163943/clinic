import { apiClient, unwrap } from '../client';
import type { ListPublicServicesQuery, PublicServiceListItem } from '@/types/public-services';

export const publicServicesApi = {
  list(params?: ListPublicServicesQuery) {
    return unwrap<PublicServiceListItem[]>(apiClient.get('/public/services', { params }));
  },
};
