'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationStore } from '@/stores/notification.store';

export default function LoginPage() {
  const { login, loginStatus, loginError } = useAuth();
  const pushToast = useNotificationStore((state) => state.push);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      pushToast({
        variant: 'warning',
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập đầy đủ Email/SĐT/CCCD và mật khẩu.',
      });
      return;
    }

    await login({ username, password });
  }

  return (
    <Card className="w-full max-w-md rounded-2xl border-0 p-8 shadow-2xl shadow-primary/10">
      <div className="mb-7 text-center">
        <h2 className="text-2xl font-bold text-foreground">Đăng nhập</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">Vui lòng đăng nhập để tiếp tục</p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor="username">
            Email, số điện thoại hoặc CCCD/CMND
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder="Vui lòng nhập Email, SĐT hoặc CCCD..."
              className="h-11 pl-10"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-foreground" htmlFor="password">
            Mật khẩu
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
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
        {loginError ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loginError.message}</span>
          </div>
        ) : null}
        <Button
          className="h-11 w-full rounded-lg bg-gradient-to-r from-primary to-primary/80 text-base font-semibold shadow-md shadow-primary/30 transition-transform hover:scale-[1.02] hover:shadow-lg"
          type="submit"
          disabled={loginStatus === 'pending'}
        >
          <LogIn className="h-4 w-4" />
          Đăng nhập
        </Button>
      </form>
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <Link className="text-sm font-medium text-primary hover:underline" href="/forgot-password">
          Quên mật khẩu?
        </Link>
        <div className="flex w-full items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">hoặc</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <p className="text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link className="font-semibold text-primary hover:underline" href="/register">
            Đăng ký tài khoản
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
