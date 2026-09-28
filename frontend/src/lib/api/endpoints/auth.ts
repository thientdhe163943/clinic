import { apiClient, unwrap, unwrapResult } from '../client';
import {
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyOtpRequest,
} from '@/types/auth';

export const authApi = {
  login(input: LoginRequest) {
    return unwrap<LoginResponse>(apiClient.post('/auth/login', input));
  },
  register(input: RegisterRequest) {
    return unwrap<LoginResponse>(apiClient.post('/auth/register', input));
  },
  forgotPassword(input: ForgotPasswordRequest) {
    return unwrap<null>(apiClient.post('/auth/forgot-password', input));
  },
  verifyOtp(input: VerifyOtpRequest) {
    return unwrap<null>(apiClient.post('/auth/verify-otp', input));
  },
  resetPassword(input: ResetPasswordRequest) {
    return unwrap<null>(apiClient.post('/auth/reset-password', input));
  },
  changePassword(input: ChangePasswordRequest) {
    return unwrapResult<null>(apiClient.put('/auth/change-password', input));
  },
  logout() {
    return unwrap<null>(apiClient.post('/auth/logout'));
  },
};
