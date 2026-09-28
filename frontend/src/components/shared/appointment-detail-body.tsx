'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Printer, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { AppointmentScheduleEditor } from '@/components/shared/appointment-schedule-editor';
import {
  useAppointmentDetail,
  useConfirmAppointment,
  useRejectAppointment,
} from '@/hooks/use-appointments';
import { useAppointmentEvents } from '@/hooks/use-appointment-events';
import { useCreateInvoice, useInvoiceByAppointment } from '@/hooks/use-invoices';
import { usePatient } from '@/hooks/use-patients';
import { visitsApi } from '@/lib/api/endpoints/visits';
import { formatAppointmentDateOnly } from '@/lib/utils/appointment-datetime';
import { useNotificationStore } from '@/stores/notification.store';
import type { AppointmentStatus } from '@/types/appointments';

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

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// Everything below the page-level header (identity, appointment info +
// reschedule form, invoice/actions, the 2 confirmation dialogs) — extracted
// out of the standalone [id]/page.tsx so the exact same content/logic can
// also render inside the list's quick-look Drawer, instead of duplicating
// this whole flow. Purely a mechanical extraction: no behavior changed.
export function AppointmentDetailBody({ appointmentId }: { appointmentId: string }) {
  const router = useRouter();

  // Live-refreshes this appointment when it changes elsewhere (e.g. the
  // doctor completing the visit unlocks invoice creation) — the list page
  // mounts this same hook, but this needs its own listener since it's a
  // separate query key.
  useAppointmentEvents();

  const { data: appointment, isLoading, error } = useAppointmentDetail(appointmentId);
  const { data: patient } = usePatient(appointment?.patientId);
  // Feature 64: only relevant once the appointment is COMPLETED — avoid
  // querying (and eating a 404) for every other status.
  const { data: invoice } = useInvoiceByAppointment(
    appointment?.status === 'COMPLETED' ? appointment.id : undefined,
  );

  const confirmAppointment = useConfirmAppointment();
  const rejectAppointment = useRejectAppointment();
  const createInvoice = useCreateInvoice();

  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceDiscount, setInvoiceDiscount] = useState('');

  const canCheckIn = appointment?.status === 'CONFIRMED';

  if (isLoading) {
    return <div className="p-5 text-sm text-muted-foreground">Đang tải thông tin lịch hẹn...</div>;
  }

  if (error || !appointment) {
    return <div className="p-5 text-sm text-destructive">Không tìm thấy lịch hẹn hoặc có lỗi xảy ra.</div>;
  }

  const handleConfirm = () => {
    if (!appointmentId) return;
    confirmAppointment.mutate(appointmentId);
  };

  const handleReject = () => {
    if (!appointmentId || !rejectReason.trim()) return;
    rejectAppointment.mutate(
      { id: appointmentId, data: { reason: rejectReason.trim() } },
      {
        onSuccess: () => {
          setRejectOpen(false);
          setRejectReason('');
        },
      },
    );
  };

  const handleCreateInvoice = () => {
    if (!appointmentId) return;
    const discount = invoiceDiscount.trim() ? Number(invoiceDiscount) : undefined;
    createInvoice.mutate(
      { appointmentId, discount },
      {
        onSuccess: (result) => {
          setInvoiceDialogOpen(false);
          setInvoiceDiscount('');
          if (result.data) router.push(`/receptionist/invoices/${result.data.appointmentId}`);
        },
      },
    );
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Trạng thái</p>
            <p className="text-lg font-semibold">{appointment.patientName}</p>
          </div>
          <Badge variant={statusBadgeVariant[appointment.status]}>{statusLabel[appointment.status]}</Badge>
        </div>

        {patient && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-b border-border pb-4 text-sm">
            <div>
              <p className="text-muted-foreground">Số điện thoại</p>
              <p className="font-medium">{patient.phone}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Ngày sinh</p>
              <p className="font-medium">{formatAppointmentDateOnly(patient.dateOfBirth)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">CCCD/CMND</p>
              <p className="font-medium">{patient.idCard ?? '—'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Địa chỉ</p>
              <p className="font-medium">{patient.address || '—'}</p>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <AppointmentScheduleEditor appointment={appointment} />
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Check-in lúc</p>
              <p className="font-medium">{formatDateTime(appointment.checkedInAt)}</p>
            </div>
            {appointment.cancelReason && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Lý do hủy/từ chối</p>
                <p className="font-medium text-destructive">{appointment.cancelReason}</p>
              </div>
            )}
            {!appointment.doctorId && canCheckIn && (
              <div className="col-span-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-700">
                Lịch hẹn chưa gán bác sĩ — cần chỉ định bác sĩ (và dịch vụ) trước khi có thể check-in.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {appointment.status === 'PENDING' && (
            <>
              <Button type="button" onClick={handleConfirm} disabled={confirmAppointment.isPending}>
                Xác nhận
              </Button>
              <Button type="button" variant="danger" onClick={() => setRejectOpen(true)}>
                Từ chối
              </Button>
            </>
          )}

          {canCheckIn && appointment.doctorId && (
            <Link href={`/receptionist/appointments/${appointment.id}/check-in`}>
              <Button type="button">Check-in</Button>
            </Link>
          )}
          {canCheckIn && !appointment.doctorId && (
            <Button type="button" disabled title="Cần gán bác sĩ (và dịch vụ) trước khi check-in">
              Check-in
            </Button>
          )}
          {/* Feature 60 A3: in lại phiếu khám bệnh (đã có STT) bất kỳ lúc
              nào sau check-in, không sinh bản ghi mới — chỉ còn khả dụng
              trong lúc lịch hẹn còn ở trạng thái CHECKED_IN (khớp cửa sổ
              in được của visit ở backend: WAITING/CALLED/NO_SHOW). */}
          {appointment.status === 'CHECKED_IN' && appointment.visitId && (
            <a href={visitsApi.printAdmissionSlipUrl(appointment.visitId)} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="secondary">
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                In phiếu khám bệnh
              </Button>
            </a>
          )}
          {/* Feature 64: lập hóa đơn từ lịch hẹn đã hoàn tất khám —
              chỉ 1 hóa đơn/lịch hẹn, nên chuyển sang "Xem hóa đơn" nếu
              đã có. */}
          {appointment.status === 'COMPLETED' && !invoice && (
            <Button type="button" onClick={() => setInvoiceDialogOpen(true)}>
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Lập hóa đơn
            </Button>
          )}
          {appointment.status === 'COMPLETED' && invoice && (
            <Link href={`/receptionist/invoices/${appointment.id}`}>
              <Button type="button" variant="secondary">
                <Receipt className="mr-1.5 h-3.5 w-3.5" />
                Xem hóa đơn
              </Button>
            </Link>
          )}
        </div>
      </Card>

      <Dialog open={invoiceDialogOpen} onClose={() => setInvoiceDialogOpen(false)} title="Lập hóa đơn">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hệ thống tự tính tổng tiền từ dịch vụ, cận lâm sàng và thuốc đã dùng trong lượt khám này.
          </p>
          <label className="space-y-2 block">
            <span className="text-sm font-medium text-foreground">Giảm giá (nếu có)</span>
            <Input
              type="number"
              min="0"
              value={invoiceDiscount}
              onChange={(event) => setInvoiceDiscount(event.target.value)}
              placeholder="0"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setInvoiceDialogOpen(false)}>
              Hủy
            </Button>
            <Button disabled={createInvoice.isPending} onClick={handleCreateInvoice}>
              {createInvoice.isPending ? 'Đang tạo...' : 'Tạo hóa đơn'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} title="Từ chối lịch hẹn">
        <div className="space-y-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium text-foreground">Lý do</span>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="danger"
              disabled={!rejectReason.trim() || rejectAppointment.isPending}
              onClick={handleReject}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
