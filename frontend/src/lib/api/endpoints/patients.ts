import { apiClient, unwrap, unwrapResult } from '../client';
import {
  CreatePatientRequest,
  PatientListResponse,
  PatientProfile,
  PatientQuery,
  UpdatePatientRequest,
} from '@/types/patients';

export const patientsApi = {
  findMany(query: PatientQuery = {}) {
    return unwrap<PatientListResponse>(apiClient.get('/patients', { params: query }));
  },
  findOne(id: string) {
    return unwrap<PatientProfile>(apiClient.get(`/patients/${id}`));
  },
  // UC 2.3.1 — gọi POST /patients để tạo hồ sơ bệnh nhân mới. unwrapResult()
  // vì đây là API có GHI dữ liệu, cần cả data (hồ sơ vừa tạo) lẫn message
  // (câu thông báo thành công có kèm mã bệnh nhân, do backend soạn sẵn).
  create(input: CreatePatientRequest) {
    return unwrapResult<PatientProfile>(apiClient.post('/patients', input));
  },
  update(id: string, input: UpdatePatientRequest) {
    return unwrapResult<PatientProfile>(apiClient.put(`/patients/${id}`, input));
  },
};
