import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  BulkScheduleResult,
  CreateBulkScheduleRequest,
  CreateScheduleRequest,
  ListSchedulesQuery,
  ReassignScheduleDoctorRequest,
  ReassignScheduleDoctorResult,
  Schedule,
  UpdateScheduleRequest,
} from '@/types/schedules';

export const schedulesApi = {
  list(query: ListSchedulesQuery = {}) {
    const params: Record<string, string> = {};
    if (query.userId) params.userId = query.userId;
    if (query.role) params.role = query.role;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    return unwrap<Schedule[]>(apiClient.get('/schedules', { params }));
  },

  getById(id: string) {
    return unwrap<Schedule>(apiClient.get(`/schedules/${id}`));
  },

  create(input: CreateScheduleRequest) {
    return unwrapResult<Schedule>(apiClient.post('/schedules', input));
  },

  createBulk(input: CreateBulkScheduleRequest) {
    return unwrapResult<BulkScheduleResult>(apiClient.post('/schedules/bulk', input));
  },

  update(id: string, input: UpdateScheduleRequest) {
    return unwrapResult<Schedule>(apiClient.put(`/schedules/${id}`, input));
  },

  delete(id: string) {
    return unwrapResult<null>(apiClient.delete(`/schedules/${id}`));
  },

  // Version-up 0.2 Phase 2 #9 tình huống B — ADMIN marks the doctor on this
  // shift absent and swaps in a substitute; backend also moves every still
  // -open (PENDING/CONFIRMED) appointment tied to the shift over.
  reassignDoctor(id: string, input: ReassignScheduleDoctorRequest) {
    return unwrapResult<ReassignScheduleDoctorResult>(apiClient.patch(`/schedules/${id}/reassign`, input));
  },
};
