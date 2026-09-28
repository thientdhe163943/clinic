'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorSpecialtiesApi } from '@/lib/api/endpoints/doctor-specialties';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';
import type {
  CreateSpecialtyRequest,
  ListDoctorSpecialtyProfilesQuery,
  UpdateDoctorSpecialtyRequest,
  UpdateSpecialtyRequest,
} from '@/types/doctor-specialties';

export function useSpecialtyOptions() {
  return useQuery({
    queryKey: ['doctor-specialties', 'specialties'],
    queryFn: () => doctorSpecialtiesApi.listSpecialties(),
  });
}

export function useCreateSpecialty() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (data: CreateSpecialtyRequest) => doctorSpecialtiesApi.createSpecialty(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'specialties'] });
      push({ variant: 'success', title: 'Tạo chuyên khoa thành công' });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useUpdateSpecialty() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSpecialtyRequest }) =>
      doctorSpecialtiesApi.updateSpecialty(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'specialties'] });
      push({ variant: 'success', title: 'Cập nhật chuyên khoa thành công' });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useDeleteSpecialty() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => doctorSpecialtiesApi.deleteSpecialty(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'specialties'] });
      push({ variant: 'success', title: 'Xóa chuyên khoa thành công' });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

// UC 2.10.2 — "Bác sĩ xem hồ sơ chuyên khoa của mình". Gọi API ngay khi
// component dùng hook này được render (ví dụ khi mở trang doctor/specialty).
export function useMyDoctorSpecialty() {
  return useQuery({
    queryKey: ['doctor-specialties', 'me'],
    queryFn: () => doctorSpecialtiesApi.getMine(),
  });
}

// UC 2.10.1 — "Bác sĩ cập nhật hồ sơ chuyên khoa của mình". Đây là hook được
// gọi từ nút "Lưu hồ sơ" trong doctor/specialty/page.tsx (qua
// updateProfile.mutate(data)).
export function useUpdateMyDoctorSpecialty() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    // mutationFn: hàm THỰC SỰ gọi API — chuyển tiếp xuống doctorSpecialtiesApi.updateMine().
    mutationFn: (data: UpdateDoctorSpecialtyRequest) => doctorSpecialtiesApi.updateMine(data),
    // onSuccess: chạy SAU KHI backend trả về thành công.
    onSuccess: (result) => {
      // "invalidateQueries" nghĩa là: đánh dấu dữ liệu cache cũ (đã lưu từ
      // lần gọi useMyDoctorSpecialty() trước đó) là LỖI THỜI, buộc gọi lại
      // API để lấy dữ liệu mới nhất (có chứa bản "đang chờ duyệt" vừa nộp).
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'me'] });
      // Trang danh sách bác sĩ công khai (nếu đang mở ở tab khác) cũng nên
      // tải lại, phòng khi có thay đổi ảnh hưởng tới thông tin hiển thị công khai.
      void queryClient.invalidateQueries({ queryKey: ['public-doctors'] });
      // Hiện thông báo (toast) thành công — nội dung câu thông báo lấy trực
      // tiếp từ backend trả về (result.message), KHÔNG viết cứng ở đây.
      push({ variant: 'success', title: result.message });
    },
    // onError: chạy nếu backend từ chối (ví dụ lỗi validate, hết phiên đăng
    // nhập...) — hiện toast báo lỗi với nội dung lỗi từ backend.
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useDoctorSpecialtyProfiles(query: ListDoctorSpecialtyProfilesQuery) {
  return useQuery({
    queryKey: ['doctor-specialties', 'admin', 'doctors', query],
    queryFn: () => doctorSpecialtiesApi.listDoctorProfiles(query),
  });
}

export function useUpdateDoctorSpecialtyProfile() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: UpdateDoctorSpecialtyRequest }) =>
      doctorSpecialtiesApi.updateDoctorProfile(userId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'admin', 'doctors'] });
      void queryClient.invalidateQueries({ queryKey: ['public-doctors'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useApproveDoctorSpecialtyUpdate() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (userId: string) => doctorSpecialtiesApi.approveDoctorProfileUpdate(userId),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'admin', 'doctors'] });
      void queryClient.invalidateQueries({ queryKey: ['public-doctors'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}

export function useRejectDoctorSpecialtyUpdate() {
  const queryClient = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      doctorSpecialtiesApi.rejectDoctorProfileUpdate(userId, reason),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['doctor-specialties', 'admin', 'doctors'] });
      void queryClient.invalidateQueries({ queryKey: ['public-doctors'] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: ApiError) => push({ variant: 'error', title: err.message }),
  });
}
