'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CreditCard, KeyRound, Mail, Phone, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  AppointmentBookingFields,
  type AppointmentBookingFieldsHandle,
} from '@/components/shared/appointment-booking-fields';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import {
  useConfirmGuestAppointmentOtp,
  useGuestBookingRedirect,
  useRequestGuestAppointmentOtp,
} from '@/hooks/use-appointments';
import { useNotificationStore } from '@/stores/notification.store';
import { cn } from '@/lib/utils/cn';
import {
  FULL_NAME_MAX_LENGTH,
  validateDateOfBirth,
  validateEmail,
  validateFullName,
  validateIdCard,
  validatePhone,
} from '@/lib/utils/identity-validation';
import { todayDateString } from '@/lib/utils/date';
import type { BookGuestAppointmentResponse, RequestGuestAppointmentOtpRequest, RequestGuestAppointmentOtpResponse } from '@/types/appointments';
import type { Gender } from '@/types/patients';

const DEFAULT_PATIENT_PASSWORD = 'Patient@123';

interface RegisterFields {
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  idCard: string;
}

const initialForm: RegisterFields = {
  fullName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: 'MALE',
  idCard: '',
};

export default function GuestBookingPage() {
  const pushToast = useNotificationStore((state) => state.push);
  const requestOtp = useRequestGuestAppointmentOtp();
  const confirmOtp = useConfirmGuestAppointmentOtp();
  const redirectAfterBooking = useGuestBookingRedirect();
  const fieldsRef = useRef<AppointmentBookingFieldsHandle>(null);

  const [form, setForm] = useState<RegisterFields>(initialForm);
  const [note, setNote] = useState('');
  // Holds the just-created session so the credentials dialog can show the
  // login identifier/password before navigating away — cleared implicitly
  // by navigation once the guest dismisses it.
  const [completedSession, setCompletedSession] = useState<BookGuestAppointmentResponse | null>(null);

  // Version-up 0.2 item #7: two-step OTP flow. `otpSession` holds the token
  // + email returned by POST /appointments/guest/otp — its presence is what
  // switches the page from the booking form to the OTP-entry step.
  // `pendingOtpRequest` is the exact payload that produced it, kept around
  // so "Gửi lại mã" can re-request without needing the (possibly unmounted)
  // booking-fields ref again.
  const [otpSession, setOtpSession] = useState<RequestGuestAppointmentOtpResponse | null>(null);
  const [pendingOtpRequest, setPendingOtpRequest] = useState<RequestGuestAppointmentOtpRequest | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!otpExpiresAt) {
      setRemainingSeconds(0);
      return;
    }
    const tick = () => setRemainingSeconds(Math.max(0, Math.round((otpExpiresAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [otpExpiresAt]);

  function handleChange<K extends keyof RegisterFields>(key: K, value: RegisterFields[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildOtpRequest(): RequestGuestAppointmentOtpRequest | null {
    // Quick-account business rule: Họ tên/SĐT/Ngày sinh/Email are required —
    // email is now mandatory (not just optional, as in the legacy one-step
    // flow) because OTP delivery is email-only. Giới tính/CCCD stay optional.
    const requiredFields: (keyof RegisterFields)[] = ['fullName', 'email', 'phone', 'dateOfBirth'];
    const hasEmptyRequiredField = requiredFields.some((key) => !form[key].trim());
    if (hasEmptyRequiredField) {
      pushToast({
        variant: 'warning',
        title: 'Thiếu thông tin',
        description: 'Vui lòng nhập Họ tên, Email, Số điện thoại và Ngày sinh.',
      });
      return null;
    }

    const fieldError =
      validateFullName(form.fullName) ??
      validatePhone(form.phone) ??
      validateDateOfBirth(form.dateOfBirth) ??
      validateEmail(form.email, { required: true }) ??
      validateIdCard(form.idCard, { required: false });
    if (fieldError) {
      pushToast({ variant: 'warning', title: 'Thông tin không hợp lệ', description: fieldError });
      return null;
    }

    if (!fieldsRef.current?.validate()) {
      pushToast({
        variant: 'warning',
        title: 'Vui lòng kiểm tra lại thông tin đặt lịch',
        description: fieldsRef.current?.getFirstError() ?? undefined,
      });
      return null;
    }

    const bookingPayload = fieldsRef.current.getPayload();
    if (!bookingPayload) {
      pushToast({ variant: 'warning', title: 'Vui lòng kiểm tra lại thông tin đặt lịch' });
      return null;
    }

    return {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender || undefined,
      idCard: form.idCard.trim() || undefined,
      doctorId: bookingPayload.doctorId,
      serviceId: bookingPayload.serviceId,
      appointmentTime: bookingPayload.appointmentTime,
      note: bookingPayload.note,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const otpRequest = buildOtpRequest();
    if (!otpRequest) return;

    await requestOtp.mutateAsync(otpRequest).then((result) => {
      setPendingOtpRequest(otpRequest);
      setOtpSession(result);
      setOtpExpiresAt(Date.now() + result.expiresInMinutes * 60_000);
      setOtpCode('');
    });
  }

  function handleResendOtp() {
    if (!pendingOtpRequest) return;
    requestOtp.mutateAsync(pendingOtpRequest).then((result) => {
      setOtpSession(result);
      setOtpExpiresAt(Date.now() + result.expiresInMinutes * 60_000);
      setOtpCode('');
    });
  }

  async function handleConfirmOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!otpSession) return;
    if (otpCode.trim().length !== 6) {
      pushToast({ variant: 'warning', title: 'Vui lòng nhập đủ 6 số mã OTP' });
      return;
    }

    await confirmOtp
      .mutateAsync({ otpToken: otpSession.otpToken, otpCode: otpCode.trim() })
      .then((session) => {
        setCompletedSession(session);
      });
  }

  function handleBackToForm() {
    setOtpSession(null);
    setOtpExpiresAt(null);
    setOtpCode('');
  }

  function handleDialogConfirm() {
    if (!completedSession) return;
    redirectAfterBooking(completedSession);
  }

  return (
    <PatientSiteShell>
      <div className={otpSession ? 'mx-auto max-w-2xl px-4 py-8 sm:py-12' : 'mx-auto max-w-4xl px-4 py-8 sm:py-12'}>
        {otpSession ? (
          <Card className="rounded-2xl border-0 p-8 shadow-2xl shadow-primary/10">
            <div className="mb-7 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
              <h2 className="mt-3 text-2xl font-bold text-foreground">Xác minh email</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Mã OTP gồm 6 số đã được gửi tới{' '}
                <span className="font-medium text-foreground">{otpSession.email}</span>. Vui lòng nhập mã để hoàn
                tất đặt lịch.
              </p>
            </div>
            <form className="space-y-5" onSubmit={handleConfirmOtp}>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-foreground" htmlFor="otpCode">
                  Mã OTP <span className="text-destructive">*</span>
                </label>
                <Input
                  id="otpCode"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="h-12 text-center text-lg tracking-[0.5em]"
                  autoFocus
                />
              </div>

              <p className="text-center text-xs text-muted-foreground">
                {remainingSeconds > 0
                  ? `Mã có hiệu lực trong ${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`
                  : 'Mã đã hết hạn, vui lòng bấm "Gửi lại mã".'}
              </p>

              <Button
                className="h-11 w-full rounded-lg bg-gradient-to-r from-primary to-primary/80 text-base font-semibold shadow-md shadow-primary/30 transition-transform hover:scale-[1.02] hover:shadow-lg"
                type="submit"
                disabled={confirmOtp.isPending || otpCode.trim().length !== 6}
              >
                {confirmOtp.isPending ? 'Đang xác nhận...' : 'Xác nhận & đặt lịch'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  onClick={handleBackToForm}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Quay lại
                </button>
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline disabled:opacity-60"
                  onClick={handleResendOtp}
                  disabled={requestOtp.isPending}
                >
                  {requestOtp.isPending ? 'Đang gửi lại...' : 'Gửi lại mã'}
                </button>
              </div>
            </form>
          </Card>
        ) : (
          <Card className="rounded-2xl border-0 p-8 shadow-2xl shadow-primary/10">
            <div className="mb-7 text-center">
              <h2 className="text-2xl font-bold text-foreground">Đặt lịch khám nhanh</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Không cần tài khoản có sẵn — điền thông tin bên dưới để đăng ký và đặt lịch trong một bước.
              </p>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    1
                  </span>
                  <p className="text-base font-bold text-foreground">Thông tin cá nhân</p>
                </div>
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
                      onChange={(event) => handleChange('gender', event.target.value as Gender)}
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
                    Số CCCD/CMND
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
                <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                  Tài khoản của bạn sẽ được cấp mật khẩu mặc định — bạn cần đổi mật khẩu ngay sau lần đăng nhập đầu
                  tiên. Một mã OTP sẽ được gửi tới email trên để xác minh trước khi lịch hẹn được tạo.
                </p>
              </div>

              <div className="space-y-4 border-t-2 border-dashed border-border pt-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    2
                  </span>
                  <p className="text-base font-bold text-foreground">Chọn bác sĩ & lịch khám</p>
                </div>
                <AppointmentBookingFields ref={fieldsRef} note={note} onNoteChange={setNote} variant="tabs" />
              </div>

              <Button
                className="h-11 w-full rounded-lg bg-gradient-to-r from-primary to-primary/80 text-base font-semibold shadow-md shadow-primary/30 transition-transform hover:scale-[1.02] hover:shadow-lg"
                type="submit"
                disabled={requestOtp.isPending}
              >
                {requestOtp.isPending ? 'Đang gửi mã xác minh...' : 'Gửi mã xác minh'}
              </Button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Đã có tài khoản?{' '}
                <Link className="font-semibold text-primary hover:underline" href="/login">
                  Đăng nhập
                </Link>
              </p>
            </div>
          </Card>
        )}
      </div>

      <Dialog
        open={Boolean(completedSession)}
        onClose={handleDialogConfirm}
        title="Đăng ký & đặt lịch thành công!"
        description="Ghi lại thông tin đăng nhập bên dưới — bạn sẽ cần đổi mật khẩu ngay sau khi đăng nhập."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Lịch hẹn của bạn đã được ghi nhận, chờ lễ tân xác nhận. Tài khoản đăng nhập đã được tạo tự động.
            </span>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Đăng nhập bằng Số điện thoại (hoặc Email/CCCD nếu đã cung cấp):</span>
            </div>
            <p className="pl-6 font-medium text-foreground">{completedSession?.user.phone}</p>
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Mật khẩu mặc định:</span>
            </div>
            <p className="pl-6 font-medium text-foreground">{DEFAULT_PATIENT_PASSWORD}</p>
          </div>

          <p className="text-xs text-muted-foreground">
            Bạn sẽ được chuyển đến màn hình đổi mật khẩu ngay sau khi bấm nút bên dưới — vui lòng đặt mật khẩu mới để
            bảo mật tài khoản.
          </p>

          <Button className="w-full" onClick={handleDialogConfirm}>
            Đã hiểu, tiếp tục
          </Button>
        </div>
      </Dialog>
    </PatientSiteShell>
  );
}
