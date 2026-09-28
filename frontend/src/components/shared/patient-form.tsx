'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/shared/form-field';
import { apiToFieldError, validateForm, type FormErrors } from '@/lib/utils/patient-form';
import { todayDateString } from '@/lib/utils/date';
import type { ApiError } from '@/types/api';
import type { CreatePatientRequest } from '@/types/patients';

interface PatientFormProps {
  initial: CreatePatientRequest;
  onSubmit: (data: CreatePatientRequest) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
  patientCode?: string;
  /** "create" shows the optional login-account checkbox; "edit" (default) doesn't. */
  mode?: 'create' | 'edit';
}

export function PatientForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  submitLabel,
  patientCode,
  mode = 'edit',
}: PatientFormProps) {
  const [form, setForm] = useState<CreatePatientRequest>(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  // Always holds the latest form values — avoids stale-closure issues in handleSubmit
  const formRef = useRef(form);
  formRef.current = form;

  function set<K extends keyof CreatePatientRequest>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((p) => ({ ...p, [key]: value }));
      if (errors[key as string]) setErrors((p) => ({ ...p, [key as string]: undefined }));
    };
  }

  // ĐIỂM BẮT ĐẦU CỦA UC 2.3.1 — được gọi khi Lễ tân bấm nút "Tạo hồ sơ"
  // (submit form) ở cuối trang "Tạo hồ sơ bệnh nhân".
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Read from ref to guarantee we have the latest values regardless of render cycle
    const current = formRef.current;
    // Kiểm tra hợp lệ ngay trên trình duyệt (họ tên/SĐT/ngày sinh không được
    // để trống, đúng định dạng...) trước khi gọi API — tránh gửi lên backend
    // những request chắc chắn sẽ bị từ chối.
    const vErrs = validateForm(current);

    // Business rule (2026-07-19, email requirement dropped 2026-08-07):
    // every new patient profile automatically gets a login account (fixed
    // default password, forced change on first login — see
    // CreatePatientUseCase). Phone + CCCD/CMND are mandatory in create mode
    // and both work as login identifiers on their own; email is optional.
    // Edit mode never touches the account, so it doesn't require idCard either.
    if (mode === 'create' && !current.idCard?.trim()) {
      vErrs.idCard = 'CCCD/CMND không được để trống — bắt buộc để tạo tài khoản đăng nhập cho bệnh nhân';
    }

    if (Object.keys(vErrs).length > 0) {
      setErrors(vErrs);
      return;
    }
    try {
      // "onSubmit" là hàm được TRUYỀN TỪ TRANG CHA VÀO (component này chỉ lo
      // phần giao diện form, không tự gọi API) — với trang tạo mới, hàm này
      // chính là handleCreate() trong receptionist/patients/new/page.tsx.
      await onSubmit({
        ...current,
        fullName: current.fullName.trim(),
        email: current.email?.trim() || undefined,
        phone: current.phone.trim(),
        idCard: current.idCard?.trim() || undefined,
        address: current.address?.trim() || undefined,
        note: current.note?.trim() || undefined,
      });
    } catch (err) {
      const fieldErrs = apiToFieldError(err as ApiError);
      if (Object.keys(fieldErrs).length > 0) setErrors(fieldErrs);
    }
  }

  const errorList = [...new Set(Object.values(errors).filter((v): v is string => Boolean(v)))];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error banner — always visible at top when there are validation errors */}
      {errorList.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-sm font-semibold text-destructive mb-1">Vui lòng kiểm tra lại:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {errorList.map((msg) => (
              <li key={msg} className="text-sm text-destructive">
                {msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {patientCode && (
        <p className="text-sm text-muted-foreground">
          Mã BN: <span className="font-medium text-foreground">{patientCode}</span>
        </p>
      )}

      <Field id="fullName" label="Họ tên" required error={errors.fullName}>
        <Input id="fullName" value={form.fullName} onChange={set('fullName')} placeholder="Nguyễn Văn A" />
      </Field>

      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" type="email" value={form.email ?? ''} onChange={set('email')} placeholder="patient@example.com" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field id="dateOfBirth" label="Ngày sinh" required error={errors.dateOfBirth}>
          <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={todayDateString()} />
        </Field>
        <Field id="gender" label="Giới tính">
          <select
            id="gender"
            value={form.gender}
            onChange={set('gender')}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="MALE">Nam</option>
            <option value="FEMALE">Nữ</option>
            <option value="OTHER">Khác</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field id="phone" label="Số điện thoại" required error={errors.phone}>
          <Input id="phone" value={form.phone} onChange={set('phone')} placeholder="0912345678" />
        </Field>
        <Field id="idCard" label="CCCD/CMND" required={mode === 'create'} error={errors.idCard}>
          <Input id="idCard" value={form.idCard ?? ''} onChange={set('idCard')} placeholder="012345678901" />
        </Field>
      </div>

      <Field id="address" label="Địa chỉ">
        <Input id="address" value={form.address ?? ''} onChange={set('address')} placeholder="Địa chỉ liên hệ" />
      </Field>

      <Field id="note" label="Ghi chú">
        <textarea
          id="note"
          className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          value={form.note ?? ''}
          onChange={set('note')}
          placeholder="Thông tin hành chính cần lưu ý"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={Boolean(form.notificationConsent)}
          onChange={set('notificationConsent')}
        />
        Đồng ý nhận nhắc lịch
      </label>

      {mode === 'create' && (
        <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          Hệ thống sẽ tự động tạo tài khoản đăng nhập cho bệnh nhân, mật khẩu mặc định{' '}
          <span className="font-medium text-foreground">Patient@123</span> — bệnh nhân bắt buộc phải đổi mật khẩu
          ngay trong lần đăng nhập đầu tiên. Có thể đăng nhập bằng Email, số điện thoại hoặc CCCD/CMND.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Đang lưu...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
