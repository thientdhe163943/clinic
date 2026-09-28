import { apiClient, unwrap, unwrapResult } from '../client';
import {
  MedicalRecordDetail,
  MedicalRecordListResponse,
  MedicalRecordPrintView,
  MedicalRecordQuery,
  UpdateMedicalRecordRequest,
} from '@/types/medical-records';

export const medicalRecordsApi = {
  findMany(query: MedicalRecordQuery = {}) {
    return unwrap<MedicalRecordListResponse>(apiClient.get('/medical-records', { params: query }));
  },
  // UC 2.3.2 — gọi GET /medical-records/:patientId để xem bệnh án 1 bệnh
  // nhân cụ thể.
  findOne(patientId: string) {
    return unwrap<MedicalRecordDetail>(apiClient.get(`/medical-records/${patientId}`));
  },
  findMine() {
    return unwrap<MedicalRecordDetail>(apiClient.get('/medical-records/me'));
  },
  print(patientId: string, visitIds?: string[]) {
    return unwrap<MedicalRecordPrintView>(
      apiClient.get(`/medical-records/${patientId}/print`, {
        params: visitIds && visitIds.length > 0 ? { visitIds: visitIds.join(',') } : undefined,
      }),
    );
  },
  // UC 2.3.3 — gọi PUT /medical-records/:patientId để bác sĩ lưu cập nhật
  // bệnh án. unwrapResult() vì có ghi dữ liệu, cần cả data (bệnh án mới) lẫn
  // message (thông báo thành công).
  update(patientId: string, input: UpdateMedicalRecordRequest) {
    return unwrapResult<MedicalRecordDetail>(apiClient.put(`/medical-records/${patientId}`, input));
  },
};
