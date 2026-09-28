export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponseOptions {
  code?: string;
  traceId?: string;
  meta?: PaginationMeta;
}

export class ApiResponse<T> {
  success: boolean;
  code: string;
  message: string;
  data: T | null;
  meta?: PaginationMeta;
  traceId?: string;
  timestamp: string;

  private constructor(success: boolean, data: T | null, message: string, options?: ApiResponseOptions) {
    this.success = success;
    this.code = options?.code ?? (success ? 'OK' : 'ERROR');
    this.message = message;
    this.data = data;
    this.meta = options?.meta;
    this.traceId = options?.traceId;
    this.timestamp = new Date().toISOString();
  }

  static ok<T>(data: T, message = 'Success', options?: ApiResponseOptions): ApiResponse<T> {
    return new ApiResponse(true, data, message, options);
  }

  static paginated<T>(
    data: T,
    meta: PaginationMeta,
    message = 'Success',
    options?: Omit<ApiResponseOptions, 'meta'>,
  ): ApiResponse<T> {
    return new ApiResponse(true, data, message, { ...options, meta });
  }

  static fail(message: string, options?: ApiResponseOptions): ApiResponse<null> {
    return new ApiResponse(false, null, message, options);
  }
}
