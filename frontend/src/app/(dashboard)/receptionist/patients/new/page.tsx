'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { PatientForm } from '@/components/shared/patient-form';
import { useCreatePatient } from '@/hooks/use-patients';
import type { CreatePatientRequest, PatientProfile } from '@/types/patients';

const EMPTY_FORM: CreatePatientRequest = {
  fullName: '',
  email: '',
  dateOfBirth: '',
  gender: 'MALE',
  phone: '',
  idCard: '',
  address: '',
  note: '',
  notificationConsent: true,
};

// Fixed system default set by CreatePatientUseCase for every walk-in
// account (see DEFAULT_PATIENT_PASSWORD in clinic_system's
// password-policy.vo.ts) — surfaced here so the receptionist has something
// to read out to the patient; not a secret specific to this account.
const DEFAULT_PATIENT_PASSWORD = 'Patient@123';

// Trang "Tạo hồ sơ bệnh nhân" (UC 2.3.1) dành cho Lễ tân. Form nhập liệu
// thật sự nằm ở component dùng chung <PatientForm> (patient-form.tsx) — nút
// "Tạo hồ sơ" trong đó khi bấm sẽ gọi ngược lên hàm handleCreate() bên dưới
// (truyền qua prop onSubmit).
export default function ReceptionistPatientCreatePage() {
  const router = useRouter();
  // redirect: false — this page shows the account-credentials Dialog first;
  // navigation to the detail page happens when the receptionist closes it.
  const createPatient = useCreatePatient({ redirect: false });
  const [createdPatient, setCreatedPatient] = useState<PatientProfile | null>(null);

  // Được <PatientForm> gọi (qua prop onSubmit) sau khi Lễ tân bấm "Tạo hồ
  // sơ" và dữ liệu đã qua kiểm tra hợp lệ trên trình duyệt.
  async function handleCreate(payload: CreatePatientRequest) {
    // "Bắn" request thật sự lên backend — xem hook useCreatePatient() trong
    // use-patients.ts để biết chuyện gì xảy ra tiếp theo.
    createPatient.mutate(payload, {
      onSuccess: (result) => {
        // Tạo thành công -> lưu lại thông tin bệnh nhân vừa tạo để hiện
        // popup (Dialog) đọc mật khẩu mặc định cho bệnh nhân nghe.
        if (result.data) setCreatedPatient(result.data);
      },
    });
  }

  function goToDetail() {
    if (createdPatient) router.push(`/receptionist/patients/${createdPatient.id}`);
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Tạo hồ sơ bệnh nhân"
        description="Đăng ký thông tin hành chính cho bệnh nhân mới."
        action={
          <Link href="/receptionist/patients">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />
      <section className="space-y-4 p-5">
        <Card className="p-6">
          <PatientForm
            initial={EMPTY_FORM}
            onSubmit={handleCreate}
            onCancel={() => router.back()}
            loading={createPatient.isPending}
            submitLabel="Tạo hồ sơ"
            mode="create"
          />
        </Card>
      </section>

      <Dialog open={Boolean(createdPatient)} onClose={goToDetail} title="Tạo hồ sơ thành công">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hệ thống đã tạo tài khoản đăng nhập cho bệnh nhân. Vui lòng đọc thông tin dưới đây cho bệnh nhân trước khi
            rời màn hình — mật khẩu mặc định chỉ hiển thị đúng 1 lần ở đây.
          </p>
          <div className="space-y-2 rounded-md border border-border bg-muted p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Mã bệnh nhân</span>
              <span className="font-medium">{createdPatient?.patientCode}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Số điện thoại</span>
              <span className="font-medium">{createdPatient?.phone}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{createdPatient?.email ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">CCCD/CMND</span>
              <span className="font-medium">{createdPatient?.idCard}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Mật khẩu mặc định</span>
              <span className="font-mono font-medium">{DEFAULT_PATIENT_PASSWORD}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Bệnh nhân có thể đăng nhập bằng bất kỳ thông tin nào ở trên (SĐT, Email, hoặc CCCD/CMND) cùng mật khẩu mặc
            định.
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Bệnh nhân sẽ được yêu cầu đổi mật khẩu ngay khi đăng nhập lần đầu.
          </p>
          <Button className="w-full" onClick={goToDetail}>
            Đã xong — xem hồ sơ
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
