import { apiClient, unwrap, unwrapResult } from '../client';
import type { Medicine } from '@/types/visits';
import type {
  AdminMedicine,
  AdminMedicineListResponse,
  CreateMedicineRequest,
  UpdateMedicineRequest,
} from '@/types/medicines';

export const medicinesApi = {
  // Legacy/bare-array mode (no `page` param) — used by the doctor
  // prescribing flow's live-search medicine picker. Keep signature untouched.
  list(search?: string) {
    return unwrap<Medicine[]>(apiClient.get('/medicines', { params: search ? { search } : {} }));
  },
  // Paginated admin-management mode (passes `page`) — used by the admin
  // medicine CRUD page.
  listAdmin(params?: { search?: string; page?: number; limit?: number }) {
    return unwrap<AdminMedicineListResponse>(
      apiClient.get('/medicines', { params: { page: 1, limit: 20, ...params } }),
    );
  },
  create(data: CreateMedicineRequest) {
    return unwrapResult<AdminMedicine>(apiClient.post('/medicines', data));
  },
  update(id: string, data: UpdateMedicineRequest) {
    return unwrapResult<AdminMedicine>(apiClient.put(`/medicines/${id}`, data));
  },
  remove(id: string) {
    return unwrapResult<null>(apiClient.delete(`/medicines/${id}`));
  },
};
