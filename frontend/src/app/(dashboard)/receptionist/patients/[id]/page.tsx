'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { PatientForm } from '@/components/shared/patient-form';
import { MedicalRecordDocument } from '@/components/shared/medical-record-readonly-workspace';
import { Pagination } from '@/components/shared/pagination';
import { usePatient, useUpdatePatient } from '@/hooks/use-patients';
import { useMedicalRecord } from '@/hooks/use-medical-records';
import { useAppointments } from '@/hooks/use-appointments';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';
import type { CreatePatientRequest, UpdatePatientRequest } from '@/types/patients';
import type { AppointmentStatus } from '@/types/appointments';

function toDateInput(v?: string | null) {
  return v ? v.slice(0, 10) : '';
}

const statusLabel: Record<AppointmentStatus, string> = {
  PENDING: 'Chưa xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã check-in',
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const statusBadgeVariant: Record<AppointmentStatus, 'muted' | 'default' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'muted',
  CONFIRMED: 'default',
  CHECKED_IN: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const TABS = [
  { id: 'info', label: 'Thông tin hành chính' },
  { id: 'record', label: 'Hồ sơ bệnh án' },
  { id: 'history', label: 'Lịch sử lịch hẹn' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ReceptionistPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [activeTab, setActiveTab] = useState<TabId>('info');

  // Dynamic [id] pages are reused by Next.js across id-to-id navigation — reset
  // back to the first tab whenever the route's own id param changes, so
  // switching from one patient to another doesn't leave a stale tab (e.g.
  // "Lịch sử lịch hẹn") selected against the new patient's data.
  useEffect(() => {
    setActiveTab('info');
  }, [patientId]);

  const { data: patient, isLoading, error } = usePatient(patientId);
  const updatePatient = useUpdatePatient();

  async function handleUpdate(payload: UpdatePatientRequest) {
    if (!patientId) return;
    await updatePatient.mutateAsync({ id: patientId, input: payload });
  }

  if (isLoading) {
    return <div className="p-5 text-sm text-muted-foreground">Đang tải thông tin bệnh nhân...</div>;
  }

  if (error || !patient) {
    return <div className="p-5 text-sm text-destructive">Không tìm thấy hồ sơ bệnh nhân hoặc có lỗi xảy ra.</div>;
  }

  const initial: CreatePatientRequest = {
    fullName: patient.fullName,
    email: patient.email ?? '',
    dateOfBirth: toDateInput(patient.dateOfBirth),
    gender: patient.gender,
    phone: patient.phone,
    idCard: patient.idCard ?? '',
    address: patient.address ?? '',
    note: patient.note ?? '',
    notificationConsent: patient.notificationConsent,
  };

  const tabs: TabItem[] = TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    content:
      tab.id === 'info' ? (
        <Card className="p-6">
          <PatientForm
            key={patient.id}
            initial={initial}
            onSubmit={handleUpdate}
            onCancel={() => router.back()}
            loading={updatePatient.isPending}
            submitLabel="Lưu thay đổi"
            patientCode={patient.patientCode}
          />
        </Card>
      ) : tab.id === 'record' ? (
        <PatientMedicalRecordTab patientId={patient.id} />
      ) : (
        <PatientAppointmentHistoryTab patientId={patient.id} />
      ),
  }));

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={`Hồ sơ bệnh nhân — ${patient.fullName}`}
        description={`Mã BN ${patient.patientCode}`}
        action={
          <Link href="/receptionist/patients">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as TabId)} />
      </section>
    </div>
  );
}

function PatientMedicalRecordTab({ patientId }: { patientId: string }) {
  const { data: detail, isLoading, error } = useMedicalRecord(patientId);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Đang tải hồ sơ bệnh án...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">{error.message}</p>;
  }

  if (!detail) return null;

  // Feature 85 business rule: AI summary is PATIENT-role only (see the
  // comment on MedicalRecordDocumentProps) — stays off here since this is
  // the staff-facing receptionist view.
  return <MedicalRecordDocument detail={detail} />;
}

function PatientAppointmentHistoryTab({ patientId }: { patientId: string }) {
  const [page, setPage] = useState(1);
  const query = useMemo(() => ({ patientId, page, limit: 20 }), [patientId, page]);
  const { data, isLoading, error } = useAppointments(query);

  const appointments = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="h-10 px-4 font-semibold">Giờ hẹn</th>
                <th className="h-10 px-4 font-semibold">Bác sĩ</th>
                <th className="h-10 px-4 font-semibold">Dịch vụ</th>
                <th className="h-10 px-4 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="h-20 px-4 text-center text-muted-foreground">
                    Đang tải lịch sử lịch hẹn...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="h-20 px-4 text-center text-destructive">
                    Không thể tải dữ liệu lịch hẹn.
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-20 px-4 text-center text-muted-foreground">
                    Bệnh nhân chưa có lịch hẹn nào.
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={appointment.id} className="border-t border-border bg-white hover:bg-muted/30">
                    <td className="h-12 px-4">{formatAppointmentDateTime(appointment.appointmentTime)}</td>
                    <td className="h-12 max-w-[160px] truncate px-4" title={appointment.doctorName}>
                      {appointment.doctorName}
                    </td>
                    <td className="h-12 max-w-[160px] truncate px-4" title={appointment.serviceName}>
                      {appointment.serviceName}
                    </td>
                    <td className="h-12 px-4">
                      <Badge variant={statusBadgeVariant[appointment.status]}>{statusLabel[appointment.status]}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
    </div>
  );
}
