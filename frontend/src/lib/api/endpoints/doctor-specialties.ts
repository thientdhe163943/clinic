import { apiClient, unwrap, unwrapResult } from '../client';
import type {
  CreateSpecialtyRequest,
  DoctorSpecialtyProfile,
  ListDoctorSpecialtyProfilesQuery,
  ListDoctorSpecialtyProfilesResponse,
  SpecialtyOption,
  UpdateDoctorSpecialtyRequest,
  UpdateSpecialtyRequest,
} from '@/types/doctor-specialties';

export const doctorSpecialtiesApi = {
  listSpecialties() {
    return unwrap<SpecialtyOption[]>(apiClient.get('/doctor-specialties/specialties'));
  },

  createSpecialty(data: CreateSpecialtyRequest) {
    return unwrap<SpecialtyOption>(apiClient.post('/doctor-specialties/specialties', data));
  },

  updateSpecialty(id: string, data: UpdateSpecialtyRequest) {
    return unwrap<SpecialtyOption>(apiClient.put(`/doctor-specialties/specialties/${id}`, data));
  },

  deleteSpecialty(id: string) {
    return unwrapResult<null>(apiClient.delete(`/doctor-specialties/specialties/${id}`));
  },

  // UC 2.10.2 — gọi GET /doctor-specialties/me. unwrap() dùng cho API xem
  // dữ liệu (GET): trả thẳng về data, không có "message" đi kèm (vì không có
  // gì để thông báo, chỉ là xem thôi).
  getMine() {
    return unwrap<DoctorSpecialtyProfile>(apiClient.get('/doctor-specialties/me'));
  },

  // UC 2.10.1 — gọi PUT /doctor-specialties/me để bác sĩ tự nộp yêu cầu cập
  // nhật hồ sơ chuyên khoa. unwrapResult() dùng cho API có THAY ĐỔI dữ liệu
  // (PUT/POST/PATCH/DELETE): trả về cả data LẪN message (câu thông báo do
  // backend soạn sẵn) để hiển thị toast báo thành công.
  updateMine(data: UpdateDoctorSpecialtyRequest) {
    return unwrapResult<DoctorSpecialtyProfile>(apiClient.put('/doctor-specialties/me', data));
  },

  listDoctorProfiles(query: ListDoctorSpecialtyProfilesQuery = {}) {
    const params: Record<string, string | number> = {};
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;
    if (query.search) params.search = query.search;
    return unwrap<ListDoctorSpecialtyProfilesResponse>(
      apiClient.get('/doctor-specialties/admin/doctors', { params }),
    );
  },

  updateDoctorProfile(userId: string, data: UpdateDoctorSpecialtyRequest) {
    return unwrapResult<DoctorSpecialtyProfile>(
      apiClient.put(`/doctor-specialties/admin/doctors/${userId}`, data),
    );
  },

  approveDoctorProfileUpdate(userId: string) {
    return unwrapResult<DoctorSpecialtyProfile>(
      apiClient.post(`/doctor-specialties/admin/doctors/${userId}/approve`),
    );
  },

  rejectDoctorProfileUpdate(userId: string, reason?: string) {
    return unwrapResult<void>(
      apiClient.post(`/doctor-specialties/admin/doctors/${userId}/reject`, { reason }),
    );
  },
};
