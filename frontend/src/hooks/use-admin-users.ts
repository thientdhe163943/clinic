'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/endpoints/users';
import { useNotificationStore } from '@/stores/notification.store';
import type { CreateUserRequest, ListUsersQuery, UpdateUserRequest } from '@/types/auth';

const QUERY_KEY = 'admin-users';

export function useAdminUsers(query: ListUsersQuery) {
  return useQuery({
    queryKey: [QUERY_KEY, query],
    queryFn: () => usersApi.listUsers(query),
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (input: CreateUserRequest) => usersApi.createUser(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: { message: string }) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserRequest }) => usersApi.updateUser(id, input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      push({ variant: 'success', title: result.message });
    },
    onError: (err: { message: string }) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useToggleUserStatus() {
  const qc = useQueryClient();
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => usersApi.toggleUserStatus(id),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      // Dùng data trả về để phân biệt activate/deactivate vì backend dùng message chung.
      const title = result.data?.isActive ? 'Đã kích hoạt tài khoản' : 'Đã vô hiệu hóa tài khoản';
      push({ variant: 'success', title });
    },
    onError: (err: { message: string }) => {
      push({ variant: 'error', title: err.message });
    },
  });
}

export function useResetUserPassword() {
  const push = useNotificationStore((s) => s.push);

  return useMutation({
    mutationFn: (id: string) => usersApi.resetUserPassword(id),
    onSuccess: (result) => {
      push({ variant: 'success', title: result.message });
    },
    onError: (err: { message: string }) => {
      push({ variant: 'error', title: err.message });
    },
  });
}
