'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { usePasswordReset } from '@/hooks/use-password-reset';
import type { ApiError } from '@/types/api';

type Step = 'request' | 'verify' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const {
    sendOtp,
    sendOtpStatus,
    sendOtpError,
    verifyOtp,
    verifyOtpStatus,
    verifyOtpError,
    resetPassword,
    resetPasswordStatus,
    resetPasswordError,
  } = usePasswordReset();

  const [step, setStep] = useState<Step>('request');
  const [username, setUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendOtp({ username });
    setStep('verify');
  }

  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await verifyOtp({ username, otpCode });
    setStep('reset');
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await resetPassword({ username, otpCode, newPassword, confirmPassword });
    router.replace('/login');
  }

  const error = (sendOtpError ?? verifyOtpError ?? resetPasswordError) as ApiError | null;

  return (
    <Card className="w-full max-w-sm p-6 shadow-lg">
      <div className="mb-6 text-center">
        <h2 className="text-lg font-semibold text-foreground">Khôi phục mật khẩu</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {step === 'request' && 'Nhập email tài khoản'}
          {step === 'verify' && 'Nhập mã OTP đã được gửi đến email của bạn'}
          {step === 'reset' && 'Đặt mật khẩu mới cho tài khoản'}
        </p>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : null}

      {step === 'request' ? (
        <form className="space-y-4" onSubmit={handleSendOtp}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="email@gmail.com"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
          <Button className="w-full" type="submit" disabled={sendOtpStatus === 'pending'}>
            <Mail className="h-4 w-4" />
            Gửi OTP
          </Button>
        </form>
      ) : null}

      {step === 'verify' ? (
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="Mã OTP 6 số"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            required
          />
          <Button className="w-full" type="submit" disabled={verifyOtpStatus === 'pending'}>
            <CheckCircle2 className="h-4 w-4" />
            Xác thực OTP
          </Button>
          <Button className="w-full" type="button" variant="ghost" onClick={() => setStep('request')}>
            Gửi lại OTP
          </Button>
        </form>
      ) : null}

      {step === 'reset' ? (
        <form className="space-y-4" onSubmit={handleResetPassword}>
          <Input
            type="password"
            placeholder="Mật khẩu mới (tối thiểu 8 ký tự, có chữ và số)"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Xác nhận mật khẩu mới"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />
          <Button className="w-full" type="submit" disabled={resetPasswordStatus === 'pending'}>
            <KeyRound className="h-4 w-4" />
            Đặt lại mật khẩu
          </Button>
        </form>
      ) : null}

      <div className="mt-4 text-center">
        <Link className="text-sm font-medium text-primary hover:underline" href="/login">
          Quay lại đăng nhập
        </Link>
      </div>
    </Card>
  );
}
