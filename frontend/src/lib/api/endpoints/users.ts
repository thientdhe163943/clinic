
import { apiClient, unwrap, unwrapResult } from '../client';
import type { ApiResponse, PaginationMeta } from '@/types/api';
import type {
  AdminUser,
  CreateUserRequest,
  ListUsersQuery,
  UpdateProfileRequest,
  UpdateUserRequest,
  UserProfile,
} from '@/types/auth';

interface ListUsersResponse {
  items: AdminUser[];
  meta: PaginationMeta;
}

export const usersApi = {
  // ─── Queries (GET) — trả về data trực tiếp ─────────────────────────────────
  // Hàm này gọi tới API "GET /users/me" của backend để lấy thông tin hồ sơ
  // của người đang đăng nhập (không cần truyền userId — backend tự nhận diện
  // qua token đăng nhập). unwrap() sẽ tự "bóc" phần data ra khỏi lớp bọc
  // response chuẩn { success, data } mà backend trả về, và tự ném lỗi nếu
  // request thất bại (ví dụ hết phiên đăng nhập).
  getMe() {
    return unwrap<UserProfile>(apiClient.get('/users/me'));
  },
  listUsers(query: ListUsersQuery = {}) {
    const params: Record<string, string | number> = {};
    if (query.page) params.page = query.page;
    if (query.limit) params.limit = query.limit;
    if (query.search) params.search = query.search;
    if (query.role) params.role = query.role;
    if (query.status) params.status = query.status;
    return unwrap<ListUsersResponse>(apiClient.get<ApiResponse<ListUsersResponse>>('/users', { params }));
  },

  // ─── Mutations — trả về { data, message } để hook đọc result.message ───────
  updateMe(input: UpdateProfileRequest) {
    return unwrapResult<UserProfile>(apiClient.put('/users/me', input));
  },
  createUser(input: CreateUserRequest) {
    return unwrapResult<AdminUser>(apiClient.post('/users', input));
  },
  updateUser(id: string, input: UpdateUserRequest) {
    return unwrapResult<AdminUser>(apiClient.put(`/users/${id}`, input));
  },
  toggleUserStatus(id: string) {
    return unwrapResult<AdminUser>(apiClient.patch(`/users/${id}/status`));
  },
  resetUserPassword(id: string) {
    return unwrapResult<null>(apiClient.post(`/users/${id}/reset-password`));
  },
};
