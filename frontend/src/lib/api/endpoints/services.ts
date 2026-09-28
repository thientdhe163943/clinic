import { apiClient, unwrap, unwrapResult } from '../client';
import type { CreateServiceRequest, Service, ServiceListResponse, UpdateServiceRequest } from '@/types/services';

export const servicesApi = {
  list(params?: { search?: string; type?: string; clsCategory?: string; page?: number; limit?: number }) {
    return unwrap<ServiceListResponse>(apiClient.get('/services', { params }));
  },
  create(data: CreateServiceRequest) {
    return unwrapResult<Service>(apiClient.post('/services', data));
  },
  update(id: string, data: UpdateServiceRequest) {
    return unwrapResult<Service>(apiClient.put(`/services/${id}`, data));
  },
  remove(id: string) {
    return unwrapResult<null>(apiClient.delete(`/services/${id}`));
  },
};
