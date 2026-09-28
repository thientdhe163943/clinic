import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import type { ApiError, ApiResponse } from '@/types/api';

// Access/refresh tokens live in httpOnly cookies set by the backend — the
// browser attaches them automatically (withCredentials), so this client never
// reads or sets an Authorization header itself.
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  timeout: 30_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 401s from these endpoints are expected, user-facing errors (e.g. wrong
// credentials) — they must not trigger the global session-expiry redirect
// (nor, for /auth/refresh specifically, another refresh attempt — a 401
// there means the refresh_token itself is invalid/expired, so retrying would
// just loop).
const AUTH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/verify-otp',
  '/auth/reset-password',
  '/auth/refresh',
];

// The access token is short-lived (15m); refresh_token (7d) lives in its own
// httpOnly cookie and is normally unused after login. Without this, any 401
// past the access-token TTL forces a full re-login even though the session
// is still perfectly valid — this exchanges it for a fresh pair via
// POST /auth/refresh and retries the request that triggered the 401.
// Concurrent 401s share one in-flight refresh call: the refresh token is
// single-use/rotated server-side, so firing it twice would make the second
// call fail against an already-revoked token.
let refreshPromise: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => error.config?.url?.includes(path));
    const config = error.config as (AxiosError['config'] & { _retried?: boolean }) | undefined;

    if (error.response?.status === 401 && !isAuthEndpoint && config && !config._retried) {
      config._retried = true;
      const refreshed = await refreshSession();
      if (refreshed) {
        return apiClient(config);
      }
    }

    if (error.response?.status === 401 && !isAuthEndpoint && typeof window !== 'undefined') {
      useAuthStore.getState().clearSession();
      window.location.assign('/login');
    }

    return Promise.reject(toApiError(error));
  },
);

function toApiError(error: AxiosError<ApiResponse<unknown>>): ApiError {
  const body = error.response?.data as (ApiResponse<unknown> & { details?: unknown }) | undefined;

  return {
    code: body?.code ?? 'NETWORK_ERROR',
    message: body?.message ?? error.message,
    // Backend appends `details` at top-level for field-level conflict info
    details: body?.details ?? body?.data ?? undefined,
    traceId: body?.traceId,
  };
}

export async function unwrap<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  const response = await request;
  if (!response.data.success || response.data.data === null) {
    throw {
      code: response.data.code,
      message: response.data.message,
      traceId: response.data.traceId,
    } satisfies ApiError;
  }

  return response.data.data;
}

// Dùng cho mutation endpoints (POST / PUT / PATCH / DELETE) để lấy cả data lẫn
// message đã được backend resolve từ MessageCatalog (qua @MsgCode decorator).
// Hook onSuccess đọc result.message thay vì hardcode chuỗi tĩnh.
export interface ApiResult<T> {
  data: T | null;
  message: string;
}

export async function unwrapResult<T>(request: Promise<{ data: ApiResponse<T> }>): Promise<ApiResult<T>> {
  const response = await request;
  if (!response.data.success) {
    throw {
      code: response.data.code,
      message: response.data.message,
      traceId: response.data.traceId,
    } satisfies ApiError;
  }

  return { data: response.data.data, message: response.data.message };
}
