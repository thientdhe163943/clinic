export interface ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
  traceId?: string;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  traceId?: string;
}
