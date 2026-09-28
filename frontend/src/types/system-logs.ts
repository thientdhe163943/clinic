import type { PaginationMeta } from './api';

// Khớp SystemLogResponseDto (clinic-backend/src/application/dtos/system-logs/system-log-response.dto.ts).
// Feature 82 — log append-only, chỉ đọc: không có request type tạo/sửa/xóa.
export interface SystemLog {
  id: string;
  createdAt: string;
  userId: string | null;
  actorName: string | null;
  action: string;
  module: string;
  targetId: string | null;
  ipAddress: string | null;
  detail: Record<string, unknown> | null;
}

// `action`/`module` không phải enum cố định ở backend (free-text string) —
// filter dạng text input, không dùng Select với danh sách cứng.
export interface ListSystemLogsQuery {
  userId?: string;
  from?: string;
  to?: string;
  action?: string;
  module?: string;
  page?: number;
  limit?: number;
}

export interface ListSystemLogsResponse {
  items: SystemLog[];
  meta: PaginationMeta;
}
