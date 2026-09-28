'use client';

import { FormEvent, useState } from 'react';
import { AlertCircle, Check, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { PatientPageHeader } from '@/components/shared/patient-page-header';
import { useChangePassword } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function ChangePasswordPage() {
  const role = useAuthStore((state) => state.user?.role);
  const mustChangePassword = useAuthStore((state) => state.user?.mustChangePassword);
  const changePassword = useChangePassword();
  const pushToast = useNotificationStore((state) => state.push);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      pushToast({
        variant: 'warning',
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới.',
      });
      return;
    }

    if (!PASSWORD_PATTERN.test(newPassword)) {
      pushToast({
        variant: 'error',
        title: 'Mật khẩu mới chưa hợp lệ',
        description: 'Mật khẩu mới cần tối thiểu 8 ký tự, có cả chữ và số.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      pushToast({
        variant: 'error',
        title: 'Mật khẩu không khớp',
        description: 'Xác nhận mật khẩu mới phải giống với mật khẩu mới đã nhập.',
      });
      return;
    }

    if (newPassword === currentPassword) {
      pushToast({
        variant: 'error',
        title: 'Mật khẩu mới trùng mật khẩu cũ',
        description: 'Vui lòng đặt một mật khẩu mới khác với mật khẩu hiện tại.',
      });
      return;
    }

    await changePassword.mutateAsync({ currentPassword, newPassword, confirmPassword });
  }

  const error = changePassword.error as ApiError | null;

  const description = mustChangePassword
    ? 'Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống'
    : 'Cập nhật mật khẩu đăng nhập của bạn';

  const passwordForm = (
    <>
      {mustChangePassword ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Mật khẩu của bạn đã được đặt lại bởi quản trị viên. Vui lòng đặt mật khẩu mới.</span>
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="currentPassword">
            Mật khẩu hiện tại
          </label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="newPassword">
            Mật khẩu mới
          </label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự, có chữ và số"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            Xác nhận mật khẩu mới
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        ) : null}

        {role === 'PATIENT' ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              Tối thiểu 8 ký tự
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
              Có chữ cái và chữ số
            </li>
          </ul>
        ) : null}

        <Button className="w-full" type="submit" disabled={changePassword.isPending}>
          <KeyRound className="h-4 w-4" />
          Đổi mật khẩu
        </Button>
      </form>
    </>
  );

  if (role === 'PATIENT') {
    return (
      <main className="min-h-full bg-background">
        <PatientPageHeader icon={KeyRound} title="Đổi mật khẩu" description={description} />
        <section className="mx-auto flex max-w-6xl justify-center px-5 pb-10">
          <Card className="w-full max-w-md space-y-4 p-6">{passwordForm}</Card>
        </section>
      </main>
    );
  }

  return (
    <div>
      <PageHeader title="Đổi mật khẩu" description={description} />
      <div className="p-5">
        <Card className="max-w-md space-y-4 p-6">{passwordForm}</Card>
      </div>
    </div>
  );
}
