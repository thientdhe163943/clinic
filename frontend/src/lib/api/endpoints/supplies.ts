import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  CreateSupplyCategoryRequest,
  CreateSupplyRequest,
  DistributeSupplyRequest,
  DistributeSupplyResponse,
  ImportSuppliesRequest,
  Supply,
  SupplyCategory,
  SupplyImportResponse,
  SupplyListResponse,
  SupplyStockStatus,
  SupplyTransactionListResponse,
  SupplyTransactionType,
  UpdateSupplyCategoryRequest,
  UpdateSupplyRequest,
} from '@/types/supplies';

export const supplyCategoriesApi = {
  list() {
    return unwrap<SupplyCategory[]>(apiClient.get('/supply-categories'));
  },
  create(data: CreateSupplyCategoryRequest) {
    return unwrapResult<SupplyCategory>(apiClient.post('/supply-categories', data));
  },
  update(id: string, data: UpdateSupplyCategoryRequest) {
    return unwrapResult<SupplyCategory>(apiClient.put(`/supply-categories/${id}`, data));
  },
  remove(id: string) {
    return unwrapResult<null>(apiClient.delete(`/supply-categories/${id}`));
  },
};

export const suppliesApi = {
  list(params?: { category?: string; status?: SupplyStockStatus; search?: string; page?: number; limit?: number }) {
    return unwrap<SupplyListResponse>(apiClient.get('/supplies', { params }));
  },
  create(data: CreateSupplyRequest) {
    return unwrapResult<Supply>(apiClient.post('/supplies', data));
  },
  update(id: string, data: UpdateSupplyRequest) {
    return unwrapResult<Supply>(apiClient.put(`/supplies/${id}`, data));
  },
  remove(id: string) {
    return unwrapResult<null>(apiClient.delete(`/supplies/${id}`));
  },
  listTransactions(
    id: string,
    params?: { from?: string; to?: string; type?: SupplyTransactionType; page?: number; limit?: number },
  ) {
    return unwrap<SupplyTransactionListResponse>(apiClient.get(`/supplies/${id}/transactions`, { params }));
  },
  import(data: ImportSuppliesRequest) {
    return unwrapResult<SupplyImportResponse>(apiClient.post('/supplies/import', data));
  },
  distribute(data: DistributeSupplyRequest) {
    return unwrapResult<DistributeSupplyResponse>(apiClient.post('/supplies/distribute', data));
  },
};
