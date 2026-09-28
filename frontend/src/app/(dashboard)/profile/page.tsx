'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Mail, Phone, Save, User } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { PatientPageHeader } from '@/components/shared/patient-page-header';
import { useAuth } from '@/hooks/use-auth';
import { useProfile, useUpdateProfile } from '@/hooks/use-profile';
import { FULL_NAME_MAX_LENGTH, validateEmail, validateFullName, validatePhone } from '@/lib/utils/identity-validation';
import { useNotificationStore } from '@/stores/notification.store';
import type { ApiError } from '@/types/api';

// Trang "Hồ sơ cá nhân" — nơi người dùng bấm vào để xem/sửa thông tin của
// chính mình (họ tên, email, số điện thoại...).
export default function ProfilePage() {
  const { user } = useAuth();
  // Ngay khi trang này được mở, dòng bên dưới sẽ tự động gọi API lấy hồ sơ
  // cá nhân (xem chi tiết trong use-profile.ts). `profile` là dữ liệu trả
  // về từ server; `isLoading` cho biết API có đang tải hay không (để hiển
  // thị chữ "Đang tải..." bên dưới).
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const pushToast = useNotificationStore((state) => state.push);

  // Các biến này giữ giá trị đang hiển thị/đang gõ trong form — tách riêng
  // khỏi `profile` (dữ liệu gốc từ server) vì khi người dùng gõ vào ô nhập,
  // ta không muốn sửa thẳng vào dữ liệu gốc.
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Khi API trả về xong (biến `profile` có giá trị), tự động điền dữ liệu đó
  // vào các ô nhập trên form — đây chính là bước "Display profile" cuối cùng
  // trong luồng xử lý.
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.fullName);
    setEmail(profile.email ?? '');
    setPhone(profile.phone);
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fieldError =
      validateFullName(fullName) ??
      // Only PATIENT accounts can go without an email (phone/idCard already
      // work as login identifiers on their own) — staff accounts always get
      // one at creation (create-user.dto.ts still requires it), so keep it
      // required here for every other role.
      validateEmail(email, { required: user?.role !== 'PATIENT' }) ??
      validatePhone(phone);
    if (fieldError) {
      pushToast({ variant: 'warning', title: 'Thông tin không hợp lệ', description: fieldError });
      return;
    }

    await updateProfile.mutateAsync({ fullName, email, phone });
  }

  const error = updateProfile.error as ApiError | null;

  const profileForm = isLoading ? (
    <p className="text-sm text-muted-foreground">Đang tải...</p>
  ) : (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="role">
            Vai trò
          </label>
          <Input id="role" value={profile?.role ?? ''} disabled />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="createdAt">
            Ngày tạo tài khoản
          </label>
          <Input
            id="createdAt"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('vi-VN') : ''}
            disabled
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="fullName">
          Họ tên
        </label>
        <Input
          id="fullName"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          maxLength={FULL_NAME_MAX_LENGTH}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="email">
          Email
        </label>
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="phone">
          Số điện thoại
        </label>
        <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} required />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="idCard">
          CCCD/CMND
        </label>
        <Input id="idCard" value={profile?.idCard ?? '—'} disabled />
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      ) : null}

      {updateProfile.isSuccess ? (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Cập nhật hồ sơ thành công.</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button type="submit" disabled={updateProfile.isPending}>
          <Save className="h-4 w-4" />
          Lưu thay đổi
        </Button>
        <Link className="text-sm font-medium text-primary" href="/change-password">
          <Button type="button" variant="ghost">
            <KeyRound className="h-4 w-4" />
            Đổi mật khẩu
          </Button>
        </Link>
      </div>
    </form>
  );

  if (user?.role === 'PATIENT') {
    const initial = profile?.fullName?.trim().charAt(0).toUpperCase() ?? '?';

    return (
      <main className="min-h-full bg-background">
        <PatientPageHeader icon={User} title="Hồ sơ cá nhân" description="Xem và cập nhật thông tin liên hệ của bạn" />
        <section className="mx-auto max-w-6xl px-5 pb-10">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <Card className="p-6 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-semibold text-primary">
                {initial}
              </div>
              <p className="mt-3 text-base font-semibold text-foreground">{profile?.fullName}</p>
              <Badge variant="default" className="mt-2">
                Tài khoản bệnh nhân
              </Badge>
              <div className="mt-4 space-y-2 text-left text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{profile?.email ?? 'Chưa cập nhật'}</span>
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4 shrink-0" />
                  <span className="truncate">{profile?.phone}</span>
                </p>
              </div>
            </Card>
            <Card className="p-6">{profileForm}</Card>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div>
      <PageHeader title="Hồ sơ cá nhân" description="Xem và cập nhật thông tin liên hệ của bạn" />
      <div className="p-5">
        <Card className="max-w-xl space-y-4 p-6">{profileForm}</Card>
      </div>
    </div>
  );
}
