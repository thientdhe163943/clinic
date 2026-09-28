'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { PatientPageHeader } from '@/components/shared/patient-page-header';
import { useAppointments, useCancelAppointment } from '@/hooks/use-appointments';
import { formatAppointmentDateTimeFull } from '@/lib/utils/appointment-datetime';
import type { Appointment, AppointmentStatus } from '@/types/appointments';

// "Đã hẹn" (upcoming/active) is the default view — a patient opening this
// page almost always wants to see what's still ahead of them, not dig
// through past history first. "Tất cả" and the two history buckets are one
// click away via the filter below.
type AppointmentFilter = 'UPCOMING' | 'COMPLETED' | 'CANCELLED' | 'ALL';

const FILTER_OPTIONS: { value: AppointmentFilter; label: string }[] = [
  { value: 'UPCOMING', label: 'Lịch đã hẹn' },
  { value: 'COMPLETED', label: 'Đã hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
  { value: 'ALL', label: 'Tất cả' },
];

const UPCOMING_STATUSES: AppointmentStatus[] = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'];

function statusesForFilter(filter: AppointmentFilter): AppointmentStatus[] | undefined {
  switch (filter) {
    case 'UPCOMING': return UPCOMING_STATUSES;
    case 'COMPLETED': return ['COMPLETED'];
    case 'CANCELLED': return ['CANCELLED'];
    case 'ALL': return undefined;
  }
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

// appointmentTime is a naive VN wall-clock value labeled UTC, not a real UTC
// instant — see formatAppointmentDateTimeFull for why toLocaleString() is wrong here.
const formatDateTime = formatAppointmentDateTimeFull;

function AppointmentCard({ appointment, onCancel }: { appointment: Appointment; onCancel: (id: string) => void }) {
  const canCancel = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatDateTime(appointment.appointmentTime)}</p>
          <p className="mt-1 text-base font-semibold text-foreground">{appointment.serviceName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Bác sĩ: {appointment.doctorName}</p>
          {appointment.checkedInAt && appointment.roomName ? (
            <p className="mt-0.5 text-sm text-muted-foreground">Phòng khám: {appointment.roomName}</p>
          ) : null}
          {appointment.note ? <p className="mt-2 text-sm text-muted-foreground">Ghi chú: {appointment.note}</p> : null}
          {appointment.cancelReason ? (
            <p className="mt-2 text-sm text-destructive">Lý do hủy: {appointment.cancelReason}</p>
          ) : null}
        </div>
        <Badge variant={statusBadgeVariant[appointment.status]}>{statusLabel[appointment.status]}</Badge>
      </div>

      {canCancel ? (
        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <Button variant="danger" size="sm" onClick={() => onCancel(appointment.id)}>
            Hủy lịch hẹn
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function AppointmentListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-5">
          <div className="space-y-3">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-5 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ filter }: { filter: AppointmentFilter }) {
  const message = filter === 'ALL'
    ? 'Bạn chưa có lịch hẹn nào.'
    : 'Không có lịch hẹn nào phù hợp với bộ lọc này.';
  return (
    <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link href="/book-appointment">
        <Button>Đặt lịch khám</Button>
      </Link>
    </Card>
  );
}

export default function MyAppointmentsPage() {
  const [filter, setFilter] = useState<AppointmentFilter>('UPCOMING');
  const statuses = useMemo(() => statusesForFilter(filter), [filter]);
  const { data, isLoading } = useAppointments({ statuses });
  const cancelAppointment = useCancelAppointment();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const appointments = data?.items ?? [];

  const openCancelDialog = (id: string) => {
    setCancelTargetId(id);
    setCancelReason('');
    setCancelOpen(true);
  };

  const closeCancelDialog = () => {
    setCancelOpen(false);
    setCancelTargetId(null);
    setCancelReason('');
  };

  const handleCancel = () => {
    if (!cancelTargetId || !cancelReason.trim()) return;
    cancelAppointment.mutate(
      { id: cancelTargetId, data: { reason: cancelReason.trim() } },
      { onSuccess: () => closeCancelDialog() },
    );
  };

  return (
    <div className="min-h-full bg-background">
      <PatientPageHeader
        icon={CalendarClock}
        title="Lịch hẹn của tôi"
        description="Xem và quản lý các lịch hẹn khám của bạn"
      />

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <div className="mb-4 flex justify-end">
          <Select
            className="w-full sm:w-56"
            value={filter}
            onChange={(e) => setFilter(e.target.value as AppointmentFilter)}
            aria-label="Lọc theo trạng thái"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </div>

        {isLoading ? (
          <AppointmentListSkeleton />
        ) : appointments.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} onCancel={openCancelDialog} />
            ))}
          </div>
        )}
      </section>

      <Dialog open={cancelOpen} onClose={closeCancelDialog} title="Hủy lịch hẹn">
        <div className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium text-foreground">Lý do</span>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={closeCancelDialog}>
              Đóng
            </Button>
            <Button
              variant="danger"
              disabled={!cancelReason.trim() || cancelAppointment.isPending}
              onClick={handleCancel}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
