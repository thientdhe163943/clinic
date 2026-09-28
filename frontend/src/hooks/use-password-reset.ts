'use client';

import { useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api/endpoints/auth';
import { ForgotPasswordRequest, ResetPasswordRequest, VerifyOtpRequest } from '@/types/auth';

// Backs the 3-step forgot-password flow (UC-1.2): send OTP -> verify OTP -> reset password.
export function usePasswordReset() {
  const sendOtpMutation = useMutation({
    mutationFn: (input: ForgotPasswordRequest) => authApi.forgotPassword(input),
  });

  const verifyOtpMutation = useMutation({
    mutationFn: (input: VerifyOtpRequest) => authApi.verifyOtp(input),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (input: ResetPasswordRequest) => authApi.resetPassword(input),
  });

  return {
    sendOtp: sendOtpMutation.mutateAsync,
    sendOtpStatus: sendOtpMutation.status,
    sendOtpError: sendOtpMutation.error,
    verifyOtp: verifyOtpMutation.mutateAsync,
    verifyOtpStatus: verifyOtpMutation.status,
    verifyOtpError: verifyOtpMutation.error,
    resetPassword: resetPasswordMutation.mutateAsync,
    resetPasswordStatus: resetPasswordMutation.status,
    resetPasswordError: resetPasswordMutation.error,
  };
}
