'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { AppointmentDetailBody } from '@/components/shared/appointment-detail-body';
import { useAppointmentDetail } from '@/hooks/use-appointments';
import { useHasMedicalHistory } from '@/hooks/use-medical-records';

// Thin page shell: header + "back to list"/"medical record" actions live
// here (this page's own concern), while the actual detail content is the
// shared AppointmentDetailBody — reused as-is by the appointments list's
// quick-look Drawer. React Query dedupes the useAppointmentDetail call
// below against the identical one inside the body, so this isn't a real
// extra request.
export default function ReceptionistAppointmentDetailPage() {
  const params = useParams();
  const appointmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: appointment } = useAppointmentDetail(appointmentId);
  const { hasHistory } = useHasMedicalHistory(appointment?.patientId);

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={appointment ? `Chi tiết lịch hẹn — ${appointment.patientName}` : 'Chi tiết lịch hẹn'}
        description={appointment ? `Mã bệnh nhân ${appointment.patientCode}` : undefined}
        action={
          <div className="flex items-center gap-2">
            {appointment && (
              hasHistory ? (
                <Link href={`/medical-record/${appointment.patientId}`}>
                  <Button variant="secondary">Hồ sơ bệnh án</Button>
                </Link>
              ) : (
                <Link href={`/receptionist/patients/${appointment.patientId}`}>
                  <Button variant="secondary">Khám lần đầu</Button>
                </Link>
              )
            )}
            <Link href="/receptionist/appointments">
              <Button variant="secondary">Trở về danh sách</Button>
            </Link>
          </div>
        }
      />

      <section className="space-y-4 p-5">
        <div className="mx-auto max-w-2xl">
          <div className="space-y-4">
            {appointmentId && <AppointmentDetailBody appointmentId={appointmentId} />}
          </div>
        </div>
      </section>
    </div>
  );
}
