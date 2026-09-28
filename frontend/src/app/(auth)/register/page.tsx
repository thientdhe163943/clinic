'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, CreditCard, Eye, EyeOff, Lock, Mail, Phone, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/use-auth';
import {
  FULL_NAME_MAX_LENGTH,
  validateDateOfBirth,
  validateEmail,
  validateFullName,
  validateIdCard,
  validatePhone,
} from '@/lib/utils/identity-validation';
import { todayDateString } from '@/lib/utils/date';
import { useNotificationStore } from '@/stores/notification.store';
import { RegisterRequest } from '@/types/auth';

const initialForm: RegisterRequest = {
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: 'MALE',
  idCard: '',
  password: '',
  confirmPassword: '',
};

export default function RegisterPage() {
  const { register, registerStatus, registerError } = useAuth();
  const pushToast = useNotificationStore((state) => state.push);
  const [form, setForm] = useState<RegisterRequest>(initialForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function handleChange<K extends keyof RegisterRequest>(key: K, value: RegisterRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const hasEmptyField = Object.entries(form).some(([key, value]) => key !== 'gender' && !String(value).trim());
    if (hasEmptyField) {
      pushToast({
        variant: 'warning',
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập đầy đủ các trường trong form đăng ký.',
      });
      return;
    }

    const fieldError =
      validateFullName(form.fullName) ??
      validateEmail(form.email, { required: true }) ??
      validatePhone(form.phone) ??
      validateDateOfBirth(form.dateOfBirth) ??
      validateIdCard(form.idCard, { required: true });
    if (fieldError) {
      pushToast({ variant: 'warning', title: 'Thông tin không hợp lệ', description: fieldError });
      return;
    }

    if (form.password !== form.confirmPassword) {
      pushToast({
        variant: 'error',
        title: 'Mật khẩu không khớp',
        description: 'Mật khẩu xác nhận phải giống với mật khẩu đã nhập.',
      });
      return;
    }

    await register(form);
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-0 p-8 shadow-2xl shadow-primary/10">
      <div className="mb-7 text-center">
        <h2 className="text-2xl font-bold text-foreground">Đăng ký tài khoản</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Dành cho bệnh nhân đặt lịch và xem kết quả trực tuyến</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor="fullName">
            Họ và tên <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(event) => handleChange('fullName', event.target.value)}
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              maxLength={FULL_NAME_MAX_LENGTH}
              className="h-11 pl-10"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="email">
              Email <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => handleChange('email', event.target.value)}
                autoComplete="email"
                placeholder="email@example.com"
                className="h-11 pl-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="phone">
              Số điện thoại <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                value={form.phone}
                onChange={(event) => handleChange('phone', event.target.value)}
                autoComplete="tel"
                placeholder="09xxxxxxxx"
                className="h-11 pl-10"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="dateOfBirth">
              Ngày sinh <span className="text-destructive">*</span>
            </label>
            <Input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => handleChange('dateOfBirth', event.target.value)}
              max={todayDateString()}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground" htmlFor="gender">
              Giới tính
            </label>
            <select
              id="gender"
              value={form.gender}
              onChange={(event) => handleChange('gender', event.target.value as RegisterRequest['gender'])}
              className={cn(
                'h-11 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors',
                'focus:border-primary focus:ring-2 focus:ring-ring/20',
              )}
            >
              <option value="MALE">Nam</option>
              <option value="FEMALE">Nữ</option>
              <option value="OTHER">Khác</option>
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor="idCard">
            Số CCCD/CMND <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <CreditCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="idCard"
              value={form.idCard}
              onChange={(event) => handleChange('idCard', event.target.value)}
              autoComplete="off"
              placeholder="012345678901"
              className="h-11 pl-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor="password">
            Mật khẩu <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(event) => handleChange('password', event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-11 pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor="confirmPassword">
            Xác nhận mật khẩu <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(event) => handleChange('confirmPassword', event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className="h-11 pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {registerError ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{registerError.message}</span>
          </div>
        ) : null}
        <Button
          className="h-11 w-full rounded-lg bg-gradient-to-r from-primary to-primary/80 text-base font-semibold shadow-md shadow-primary/30 transition-transform hover:scale-[1.02] hover:shadow-lg"
          type="submit"
          disabled={registerStatus === 'pending'}
        >
          <UserPlus className="h-4 w-4" />
          Đăng ký
        </Button>
      </form>
      <div className="mt-6 space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link className="font-semibold text-primary hover:underline" href="/login">
            Đăng nhập
          </Link>
        </p>
        <p className="text-sm text-muted-foreground">
          <Link className="font-semibold text-primary hover:underline" href="/guest-booking">
            Đặt lịch nhanh không cần tài khoản
          </Link>
        </p>
      </div>
    </Card>
  );
}
