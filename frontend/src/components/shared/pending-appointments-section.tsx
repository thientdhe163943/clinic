'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Check, Eye, Search, X, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/shared/pagination';
import { useAppointments, useConfirmAppointment, useRejectAppointment } from '@/hooks/use-appointments';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';
import type { Appointment, AppointmentStatus } from '@/types/appointments';

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

// "Lịch hẹn chưa xác nhận" only ever contains PENDING appointments — this
// dropdown exists purely so the filter bar looks the same as "hôm nay"
// (both options resolve to the same PENDING-only query below), not because
// there's a second status to switch to.
const PENDING_STATUS_FILTERS: { value: AppointmentStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: statusLabel.PENDING },
];

// appointmentTime is a naive VN wall-clock value labeled UTC, not a real UTC
// instant — see formatAppointmentDateTime for why toLocaleString() is wrong here.
const formatDateTime = formatAppointmentDateTime;

// ─── Reject dialog ──────────────────────────────────────────────────────────

function ReasonDialog({
  open,
  title,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <Dialog
      open={open}
      onClose={() => {
        setReason('');
        onClose();
      }}
      title={title}
    >
      <div className="space-y-4">
        <label className="space-y-2 block">
          <span className="text-sm font-medium text-foreground">Lý do</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            placeholder="Nhập lý do..."
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="danger"
            disabled={loading || !reason.trim()}
            onClick={() => onConfirm(reason.trim())}
          >
            {loading ? 'Đang xử lý...' : 'Xác nhận'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── "Lịch hẹn chưa xác nhận" — own section, own state ──────────────────────
// Always PENDING only (booked by a patient, not yet reviewed by reception —
// a receptionist-booked appointment starts CONFIRMED already, see
// CreateAppointmentUseCase). The status dropdown below only ever resolves to
// PENDING — it exists so the filter bar matches "hôm nay" visually, not
// because there's a second status to switch to.
export function PendingAppointmentsSection({
  tabsElement,
  onShowDoctor,
  onShowDetail,
}: {
  tabsElement: ReactNode;
  onShowDoctor: (doctorId: string) => void;
  onShowDetail: (appointmentId: string) => void;
}) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [rejectTarget, setRejectTarget] = useState<Appointment | null>(null);

  const query = useMemo(
    () => ({ page, limit: 20, search: search || undefined, date: date || undefined, statuses: 'PENDING' as const }),
    [page, search, date],
  );

  const { data, isLoading, error } = useAppointments(query);
  const confirmAppointment = useConfirmAppointment();
  const rejectAppointment = useRejectAppointment();

  const appointments = data?.items ?? [];
  const meta = data?.meta;

  // Same "hide Trạng thái until a status filter is picked" treatment as the
  // "hôm nay" tab, for a consistent, uncluttered default view.
  const isFiltering = status !== '';
  const columnCount = isFiltering ? 6 : 5;

  const handleConfirm = (appointment: Appointment) => {
    confirmAppointment.mutate(appointment.id);
  };

  const handleReject = (reason: string) => {
    if (!rejectTarget) return;
    if (!window.confirm('Bạn có chắc chắn muốn từ chối lịch hẹn này?')) return;
    rejectAppointment.mutate(
      { id: rejectTarget.id, data: { reason } },
      { onSuccess: () => setRejectTarget(null) },
    );
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <form
              className="flex w-full gap-2 md:max-w-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(searchInput.trim());
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo tên/mã/SĐT bệnh nhân"
                />
              </div>
              <Button type="submit" variant="secondary">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                className="w-auto"
                value={date}
                onChange={(e) => {
                  setPage(1);
                  setDate(e.target.value);
                }}
              />
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus(e.target.value as AppointmentStatus | '');
                }}
                className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              >
                {PENDING_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(date || status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPage(1);
                    setDate('');
                    setStatus('');
                  }}
                >
                  <X className="h-4 w-4" />
                  Xóa lọc
                </Button>
              )}
            </div>
          </div>

          {tabsElement}
        </div>

        <div className="overflow-x-auto border-t border-border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="h-10 px-4 font-semibold">Bệnh nhân</th>
                <th className="h-10 px-4 font-semibold">Bác sĩ</th>
                <th className="h-10 px-4 font-semibold">Dịch vụ</th>
                <th className="h-10 px-4 font-semibold">Giờ hẹn</th>
                {isFiltering && <th className="h-10 px-4 font-semibold">Trạng thái</th>}
                <th className="h-10 min-w-[220px] px-4 font-semibold text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columnCount} className="h-20 px-4 text-center text-muted-foreground">
                    Đang tải danh sách lịch hẹn...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={columnCount} className="h-20 px-4 text-center text-destructive">
                    Không thể tải dữ liệu lịch hẹn.
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan={columnCount} className="h-20 px-4 text-center text-muted-foreground">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                appointments.map((appointment) => (
                  <tr key={appointment.id} className="border-t border-border bg-white hover:bg-muted/30">
                    <td className="h-12 px-4">
                      <p className="font-medium">{appointment.patientName}</p>
                      <p className="text-xs text-muted-foreground">{appointment.patientCode}</p>
                    </td>
                    <td className="h-12 max-w-[160px] truncate px-4" title={appointment.doctorName}>
                      {appointment.doctorId ? (
                        <button
                          type="button"
                          className="truncate text-left hover:text-primary hover:underline"
                          onClick={() => onShowDoctor(appointment.doctorId as string)}
                        >
                          {appointment.doctorName}
                        </button>
                      ) : (
                        appointment.doctorName
                      )}
                    </td>
                    <td className="h-12 max-w-[160px] truncate px-4" title={appointment.serviceName}>
                      {appointment.serviceName}
                    </td>
                    <td className="h-12 px-4">{formatDateTime(appointment.appointmentTime)}</td>
                    {isFiltering && (
                      <td className="h-12 px-4">
                        <Badge variant={statusBadgeVariant[appointment.status]}>
                          {statusLabel[appointment.status]}
                        </Badge>
                      </td>
                    )}
                    <td className="h-12 min-w-[220px] px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(appointment)}
                          disabled={confirmAppointment.isPending}
                        >
                          <Check className="h-4 w-4" />
                          Xác nhận
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setRejectTarget(appointment)}>
                          <XCircle className="h-4 w-4" />
                          Từ chối
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Chi tiết"
                          onClick={() => onShowDetail(appointment.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}

      <ReasonDialog
        open={Boolean(rejectTarget)}
        title="Từ chối lịch hẹn"
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
        loading={rejectAppointment.isPending}
      />
    </div>
  );
}
