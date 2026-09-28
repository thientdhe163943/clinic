import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  CreateSupplierRequest,
  Supplier,
  SupplierListResponse,
  UpdateSupplierRequest,
} from '@/types/suppliers';

export const suppliersApi = {
  // Legacy/bare-array mode (no `page` param) — used by the Supply-import
  // form's supplier picker. Keep signature untouched.
  list(search?: string) {
    return unwrap<Supplier[]>(apiClient.get('/suppliers', { params: search ? { search } : {} }));
  },
  // Paginated admin-management mode (passes `page`) — used by the admin
  // supplier CRUD page.
  listAdmin(params?: { search?: string; page?: number; limit?: number }) {
    return unwrap<SupplierListResponse>(
      apiClient.get('/suppliers', { params: { page: 1, limit: 20, ...params } }),
    );
  },
  create(data: CreateSupplierRequest) {
    return unwrapResult<Supplier>(apiClient.post('/suppliers', data));
  },
  update(id: string, data: UpdateSupplierRequest) {
    return unwrapResult<Supplier>(apiClient.put(`/suppliers/${id}`, data));
  },
  remove(id: string) {
    return unwrapResult<null>(apiClient.delete(`/suppliers/${id}`));
  },
};
