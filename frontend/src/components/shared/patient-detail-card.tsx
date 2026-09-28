import { Badge } from '@/components/ui/badge';
import type { Gender, PatientProfile } from '@/types/patients';

const genderLabel: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

function formatDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('vi-VN');
}

export function PatientDetailCard({ patient }: { patient: PatientProfile }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Mã bệnh nhân', value: <span className="font-mono font-medium">{patient.patientCode}</span> },
    { label: 'Họ tên', value: patient.fullName },
    { label: 'Email', value: patient.email ?? '—' },
    { label: 'Ngày sinh', value: formatDate(patient.dateOfBirth) },
    { label: 'Giới tính', value: genderLabel[patient.gender] },
    { label: 'Số điện thoại', value: patient.phone },
    { label: 'CCCD/CMND', value: patient.idCard ?? '—' },
    { label: 'Địa chỉ', value: patient.address ?? '—' },
    {
      label: 'Nhắc lịch',
      value: (
        <Badge variant={patient.notificationConsent ? 'success' : 'muted'}>
          {patient.notificationConsent ? 'Có' : 'Không'}
        </Badge>
      ),
    },
    { label: 'Ghi chú', value: patient.note ?? '—' },
    { label: 'Ngày tạo', value: formatDate(patient.createdAt) },
    { label: 'Cập nhật lần cuối', value: formatDate(patient.updatedAt) },
  ];

  return (
    <div className="space-y-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="grid grid-cols-[160px_1fr] gap-2 border-b border-border pb-2 last:border-0">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-sm">{value}</span>
        </div>
      ))}
    </div>
  );
}
