'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, Calendar, Eye, LogIn, Receipt, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ClsInvoiceDialog } from '@/components/shared/cls-invoice-dialog';
import { Pagination } from '@/components/shared/pagination';
import { RowActionMenu } from '@/components/shared/row-action-menu';
import { useAppointments } from '@/hooks/use-appointments';
import { useCreateInvoice, useInvoices } from '@/hooks/use-invoices';
import { formatAppointmentDateTime, nowAsClinicNaiveUtcMs } from '@/lib/utils/appointment-datetime';
import { cn } from '@/lib/utils/cn';
import type { Appointment, AppointmentStatus } from '@/types/appointments';
import type { Invoice } from '@/types/invoices';

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

// "Lịch hẹn hôm nay" only ever deals with appointments that have moved past
// PENDING — an unconfirmed one belongs on the "chưa xác nhận" tab instead,
// so PENDING is deliberately not a selectable option here.
const TODAY_STATUS_FILTERS: { value: AppointmentStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'CONFIRMED', label: statusLabel.CONFIRMED },
  { value: 'CHECKED_IN', label: statusLabel.CHECKED_IN },
  { value: 'IN_PROGRESS', label: statusLabel.IN_PROGRESS },
  { value: 'COMPLETED', label: statusLabel.COMPLETED },
  { value: 'CANCELLED', label: statusLabel.CANCELLED },
];

function todayDateInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// appointmentTime is a naive VN wall-clock value labeled UTC, not a real UTC
// instant — see formatAppointmentDateTime for why toLocaleString() is wrong here.
const formatDateTime = formatAppointmentDateTime;

// Feature 61 business rule (added 2026-07-08): a Confirmed appointment more
// than CONFIRMED_STALE_MINUTES (60) past its own appointment_time without
// being checked in is flagged as overdue — display hint only, backend
// already stops counting it as a slot conflict once past this threshold
// (see 06_appointment.md Feature 59 business rules).
const CONFIRMED_STALE_MINUTES = 60;

function isOverdueConfirmed(appointment: { status: string; appointmentTime: string }): boolean {
  if (appointment.status !== 'CONFIRMED') return false;
  const appointmentTime = new Date(appointment.appointmentTime).getTime();
  return nowAsClinicNaiveUtcMs() - appointmentTime > CONFIRMED_STALE_MINUTES * 60 * 1000;
}

// ─── Invoice dialog ─────────────────────────────────────────────────────────

function InvoiceDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (discount: string) => void;
  loading: boolean;
}) {
  const [discount, setDiscount] = useState('');

  return (
    <Dialog
      open={open}
      onClose={() => {
        setDiscount('');
        onClose();
      }}
      title="Lập hóa đơn"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Hệ thống tự tính tổng tiền từ dịch vụ, cận lâm sàng và thuốc đã dùng trong lượt khám này.
        </p>
        <label className="space-y-2 block">
          <span className="text-sm font-medium text-foreground">Giảm giá (nếu có)</span>
          <Input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Hủy
          </Button>
          <Button disabled={loading} onClick={() => onConfirm(discount)}>
            {loading ? 'Đang xử lý...' : 'Lập hóa đơn'}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ─── "Lịch hẹn hôm nay" — own section, own state ────────────────────────────
// Real-time board of today only (date is fixed, not user-pickable) — no
// status column by default so it reads as a quick "what's happening right
// now" glance. Picking a status from the dropdown brings the fuller
// status-aware layout back.
export function TodayAppointmentsSection({
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
  const [date, setDate] = useState(todayDateInput);
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [page, setPage] = useState(1);
  const [invoiceTarget, setInvoiceTarget] = useState<Appointment | null>(null);
  const [clsInvoiceTarget, setClsInvoiceTarget] = useState<Appointment | null>(null);

  const query = useMemo(
    () => ({ page, limit: 20, search: search || undefined, date: date || undefined, statuses: status || undefined }),
    [page, search, date, status],
  );

  const { data, isLoading, error } = useAppointments(query);
  const createInvoice = useCreateInvoice();

  // Recent invoices, joined onto each row by appointmentId below — same
  // bounded-fetch + client-side join pattern as the receptionist dashboard.
  // Lets this tab surface a mid-visit CLS fee the doctor just billed (see
  // CreateClsOrderUseCase), not only the legacy end-of-visit case.
  const { data: invoicesData } = useInvoices({ limit: 100 });
  const invoiceByAppointmentId = useMemo(() => {
    const map = new Map<string, Invoice>();
    for (const invoice of invoicesData?.items ?? []) map.set(invoice.appointmentId, invoice);
    return map;
  }, [invoicesData]);

  // Default ("Tất cả trạng thái") hides CHECKED_IN and PENDING — CHECKED_IN
  // patients have moved on to the nurse/doctor queue, and PENDING ones
  // belong on the "chưa xác nhận" tab instead (not even a selectable option
  // in TODAY_STATUS_FILTERS). Picking an explicit status from the dropdown
  // shows exactly that status.
  const appointments = useMemo(() => {
    const items = data?.items ?? [];
    if (status !== '') return items;
    return items.filter((item) => item.status !== 'CHECKED_IN' && item.status !== 'PENDING');
  }, [data, status]);
  const meta = data?.meta;

  // Untouched (no status filter picked): a plain real-time "what's happening
  // today" board — no Trạng thái column. Picking a status switches to the
  // fuller, status-aware layout below.
  const isFiltering = status !== '';
  const columnCount = isFiltering ? 6 : 5;

  const handleCreateInvoice = (discount: string) => {
    if (!invoiceTarget) return;
    createInvoice.mutate(
      { appointmentId: invoiceTarget.id, discount: discount.trim() ? Number(discount) : undefined },
      { onSuccess: () => setInvoiceTarget(null) },
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
                {TODAY_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(date !== todayDateInput() || status) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPage(1);
                    setDate(todayDateInput());
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
                <th className="h-10 min-w-[160px] px-4 font-semibold text-right">Hành động</th>
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
                appointments.map((appointment) => {
                  const overdue = isOverdueConfirmed(appointment);
                  const invoice = invoiceByAppointmentId.get(appointment.id);
                  // "Thanh toán xét nghiệm" collects exactly the CLS services
                  // the doctor ordered the patient to do (each CLS order the
                  // doctor placed mid-visit bills one unpaid CLS line onto the
                  // invoice already created at check-in — see
                  // CreateClsOrderUseCase). It is deliberately scoped to CLS
                  // lines only: the exam fee is collected at check-in and the
                  // medicine fee on the full invoice detail page, so an unpaid
                  // SERVICE/MEDICINE line must NOT surface this button.
                  // `needsLegacyInvoice` only covers appointments checked in
                  // before per-stage billing shipped and therefore never got
                  // an invoice at all.
                  const hasUnpaidClsItem =
                    invoice?.items.some((item) => item.itemType === 'CLS' && !item.paidAt) ?? false;
                  const needsLegacyInvoice = appointment.status === 'COMPLETED' && !invoice;
                  return (
                    <tr
                      key={appointment.id}
                      className={cn(
                        'border-t border-border hover:bg-muted/30',
                        overdue ? 'border-l-2 border-l-destructive bg-destructive/[0.03]' : 'bg-white',
                      )}
                    >
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
                          <div className="flex items-center gap-1.5">
                            <Badge variant={statusBadgeVariant[appointment.status]}>
                              {statusLabel[appointment.status]}
                            </Badge>
                            {overdue && (
                              <span title="Quá giờ — chưa đến" className="inline-flex shrink-0">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Quá giờ — chưa đến" />
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="h-12 min-w-[160px] px-4">
                        <div className="flex items-center justify-end gap-1">
                          {appointment.status === 'CONFIRMED' && (
                            <Link href={`/receptionist/appointments/${appointment.id}/check-in`}>
                              <Button size="sm">
                                <LogIn className="h-4 w-4" />
                                Check-in
                              </Button>
                            </Link>
                          )}
                          {hasUnpaidClsItem && (
                            <Button size="sm" variant="secondary" onClick={() => setClsInvoiceTarget(appointment)}>
                              <Receipt className="h-4 w-4" />
                              Thanh toán xét nghiệm
                            </Button>
                          )}
                          {needsLegacyInvoice && (
                            <Button size="sm" variant="secondary" onClick={() => setInvoiceTarget(appointment)}>
                              <Receipt className="h-4 w-4" />
                              Lập hóa đơn
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Chi tiết"
                            onClick={() => onShowDetail(appointment.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <RowActionMenu
                            items={[
                              ...(appointment.status === 'CONFIRMED'
                                ? [
                                    {
                                      label: 'Đổi lịch hẹn',
                                      icon: Calendar,
                                      onClick: () => onShowDetail(appointment.id),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {meta && <Pagination page={meta.page} totalPages={meta.totalPages} onPageChange={setPage} />}

      <InvoiceDialog
        open={Boolean(invoiceTarget)}
        onClose={() => setInvoiceTarget(null)}
        onConfirm={handleCreateInvoice}
        loading={createInvoice.isPending}
      />

      {clsInvoiceTarget && (
        <ClsInvoiceDialog appointment={clsInvoiceTarget} onClose={() => setClsInvoiceTarget(null)} />
      )}
    </div>
  );
}
