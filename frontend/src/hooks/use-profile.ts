'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/endpoints/auth';
import { usersApi } from '@/lib/api/endpoints/users';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { ChangePasswordRequest, UpdateProfileRequest } from '@/types/auth';

// Hook (móc nối) dùng trong component React để lấy dữ liệu hồ sơ cá nhân.
// Đây chính là nơi kích hoạt việc gọi API khi trang "Hồ sơ cá nhân" được mở.
// useQuery (thư viện TanStack Query) tự lo việc: gọi API, lưu cache kết quả
// (để lần sau vào lại trang không phải gọi lại ngay), tự cung cấp các biến
// tiện dụng như `isLoading` (đang tải hay chưa) và `data` (dữ liệu trả về)
// cho component sử dụng.
export function useProfile(options?: { enabled?: boolean }) {
  return useQuery({
    // queryKey: "tên định danh" của dữ liệu này trong bộ nhớ cache — dùng để
    // sau này các nơi khác (ví dụ sau khi cập nhật hồ sơ) có thể báo "dữ liệu
    // này cũ rồi, tải lại đi".
    queryKey: ['users', 'me'],
    // queryFn: hàm thực sự gọi API — chính là bước "Send GET /users/me".
    queryFn: () => usersApi.getMe(),
    enabled: options?.enabled,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: (input: UpdateProfileRequest) => usersApi.updateMe(input),
    onSuccess: (result) => {
      if (result.data) {
        updateUser({ fullName: result.data.fullName, email: result.data.email, phone: result.data.phone });
        queryClient.setQueryData(['users', 'me'], result.data);
      }
    },
  });
}

export function useChangePassword() {
  const router = useRouter();
  const updateUser = useAuthStore((state) => state.updateUser);
  const pushToast = useNotificationStore((state) => state.push);

  return useMutation({
    mutationFn: (input: ChangePasswordRequest) => authApi.changePassword(input),
    onSuccess: (result) => {
      updateUser({ mustChangePassword: false });
      pushToast({ variant: 'success', title: result.message });
      router.replace('/profile');
    },
  });
}
