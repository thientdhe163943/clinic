'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { AppointmentScheduleEditor } from '@/components/shared/appointment-schedule-editor';
import { PageHeader } from '@/components/shared/page-header';
import { useAppointmentDetail, useCheckInAppointment, useConfirmCheckInPayment } from '@/hooks/use-appointments';
import { useInvoiceByAppointment } from '@/hooks/use-invoices';
import { usePatient } from '@/hooks/use-patients';
import { useServiceList } from '@/hooks/use-services';
import { visitsApi } from '@/lib/api/endpoints/visits';
import { formatAppointmentDateOnly, formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';
import type { ApiError } from '@/types/api';
import type { VisitPriority } from '@/types/appointments';
import type { Invoice, PaymentMethod } from '@/types/invoices';

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'CARD', label: 'Thẻ ngân hàng' },
  { value: 'TRANSFER', label: 'Chuyển khoản' },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Backend rejects check-in when today isn't the appointment's own day
// (CheckInDateMismatchError → MSG_ERR_0063) — the fix is to reschedule the
// appointment to today, via the inline editor above.
const CHECK_IN_DATE_MISMATCH_CODE = 'MSG_ERR_0063';

const priorityOptions: { value: VisitPriority; label: string }[] = [
  { value: 'NORMAL', label: 'Thường' },
  { value: 'ELDERLY', label: 'Người cao tuổi' },
  { value: 'PREGNANT', label: 'Phụ nữ mang thai' },
  { value: 'CHILD', label: 'Trẻ em' },
  { value: 'EMERGENCY', label: 'Cấp cứu' },
];

export default function ReceptionistAppointmentCheckInPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const { data: appointment, isLoading, error } = useAppointmentDetail(appointmentId);
  const { data: patient } = usePatient(appointment?.patientId);
  // Fee preview shown before check-in even happens — appointment.serviceId
  // is known already, but there's no Invoice (and thus no billed amount)
  // until checkInAppointment actually runs, so the price comes straight
  // from the service record instead.
  const { data: feeServices } = useServiceList({ limit: 100, type: 'EXAMINATION' });
  const checkInAppointment = useCheckInAppointment();
  const confirmCheckInPayment = useConfirmCheckInPayment();

  const [priority, setPriority] = useState<VisitPriority>('NORMAL');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  // Local "đã thu tiền" confirmation — gates the final Check-in button.
  // Reception ticks this once they've actually collected the fee from the
  // patient; only then does clicking Check-in fire the real backend calls.
  const [feeConfirmedPaid, setFeeConfirmedPaid] = useState(false);
  const [queueNumber, setQueueNumber] = useState<string | null>(null);
  const [checkedInVisitId, setCheckedInVisitId] = useState<string | null>(null);
  const [dateMismatch, setDateMismatch] = useState(false);
  // Set from the check-in response for this session, so the payment-recovery
  // step below (an appointment already CHECKED_IN from a previous attempt)
  // doesn't need a second round-trip right after check-in succeeds.
  const [checkInInvoice, setCheckInInvoice] = useState<Invoice | null | undefined>(undefined);

  // Payment-before-queue change (2026-08-21): if the receptionist reloads
  // this page (or comes back later) while the appointment is already
  // CHECKED_IN but not yet paid/queued, fetch the invoice fresh instead of
  // relying on `checkInInvoice`, which only exists for the session that
  // actually submitted the check-in form.
  const needsFetchedInvoice = appointment?.status === 'CHECKED_IN' && checkInInvoice === undefined && !queueNumber;
  const { data: fetchedInvoice } = useInvoiceByAppointment(needsFetchedInvoice ? appointmentId : undefined);
  const invoice = checkInInvoice !== undefined ? checkInInvoice : (fetchedInvoice ?? null);
  const examinationItem = invoice?.items.find((item) => item.itemType === 'SERVICE' && !item.paidAt);

  if (isLoading) {
    return <div className="p-5 text-sm text-muted-foreground">Đang tải thông tin lịch hẹn...</div>;
  }

  if (error || !appointment) {
    return (
      <div className="min-h-full bg-background">
        <PageHeader
          title="Check-in lịch hẹn"
          action={
            <Link href="/receptionist/appointments">
              <Button variant="secondary">Trở về danh sách</Button>
            </Link>
          }
        />
        <div className="p-5 text-sm text-destructive">Không tìm thấy lịch hẹn hoặc có lỗi xảy ra.</div>
      </div>
    );
  }

  // CONFIRMED: hasn't checked in yet — show the check-in form below.
  // CHECKED_IN: already checked in (e.g. a previous attempt got this far but
  // not further), still needs the payment-recovery step below — once
  // queueNumber is set, keep rendering the success Dialog even though the
  // background refetch now reports IN_PROGRESS/whatever comes next.
  if (appointment.status !== 'CONFIRMED' && appointment.status !== 'CHECKED_IN' && !queueNumber) {
    return (
      <div className="min-h-full bg-background">
        <PageHeader
          title="Check-in lịch hẹn"
          action={
            <Link href="/receptionist/appointments">
              <Button variant="secondary">Trở về danh sách lịch hẹn</Button>
            </Link>
          }
        />
        <section className="p-5">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Chỉ có thể check-in khi lịch hẹn đang ở trạng thái &quot;Đã xác nhận&quot;. Lịch hẹn này hiện không ở
              trạng thái phù hợp.
            </p>
            <div className="mt-4">
              <Link href={`/receptionist/appointments/${appointment.id}`}>
                <Button variant="secondary">Xem chi tiết lịch hẹn</Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    );
  }

  // Business rule: a doctor/service must be assigned before check-in — an
  // appointment booked doctor-less (Feature 59 A4, "chưa chọn dịch vụ/bác
  // sĩ") can't be checked in until the receptionist assigns both, via the
  // "Chỉnh sửa" editor above. The backend already rejects this
  // (DoctorNotScheduledError), but blocking it here too gives a clear,
  // specific message instead of a generic API-error toast.
  const missingAssignment = !appointment.doctorId || !appointment.serviceId;
  const awaitingPayment = appointment.status === 'CHECKED_IN' && !queueNumber;
  const feeService = (feeServices?.items ?? []).find((service) => service.id === appointment.serviceId) ?? null;

  // Single combined action (per the existing 2-call flow): checkInAppointment
  // creates the CHECKED_IN status + exam-fee invoice, then
  // confirmCheckInPayment immediately collects that fee and creates the
  // Visit (queue entry) — chained here so reception only clicks once, after
  // already confirming payment above.
  const handleCheckIn = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!appointmentId || missingAssignment || !feeConfirmedPaid) return;

    setDateMismatch(false);
    checkInAppointment.mutate(
      { id: appointmentId, data: { priority } },
      {
        onSuccess: (result) => {
          setCheckInInvoice(result.data?.invoice ?? null);
          confirmCheckInPayment.mutate(
            { id: appointmentId, data: { priority, paymentMethod } },
            {
              onSuccess: (paymentResult) => {
                // Chưa có API GET /visits/{id} — số thứ tự chỉ xuất hiện đúng 1 lần
                // trong response này, nên phải hiển thị ngay cho lễ tân trước khi rời trang.
                setQueueNumber(paymentResult.data?.visit?.queueNumber ?? null);
                setCheckedInVisitId(paymentResult.data?.visit?.id ?? null);
              },
            },
          );
        },
        onError: (err: ApiError) => {
          // useCheckInAppointment's hook-level onError already shows the
          // generic toast — this only adds the inline reschedule affordance
          // for the one error where "retry" isn't the right fix.
          if (err.code === CHECK_IN_DATE_MISMATCH_CODE) {
            setDateMismatch(true);
          }
        },
      },
    );
  };

  // Recovery path only: the appointment was already checked in by a
  // previous attempt (invoice exists) but payment/queue-entry never
  // completed — same "Thanh toán & Vào hàng chờ" action as before.
  const handleConfirmPayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!appointmentId) return;

    confirmCheckInPayment.mutate(
      { id: appointmentId, data: { priority, paymentMethod } },
      {
        onSuccess: (result) => {
          setQueueNumber(result.data?.visit?.queueNumber ?? null);
          setCheckedInVisitId(result.data?.visit?.id ?? null);
        },
      },
    );
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={`Check-in lịch hẹn — ${appointment.patientName}`}
        description={`Mã bệnh nhân ${appointment.patientCode}`}
        action={
          <Link href="/receptionist/appointments">
            <Button variant="secondary">Trở về danh sách lịch hẹn</Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <Card className="p-6">
          <div className="space-y-4">
            {/* Same identity fields as the printed "Phiếu khám bệnh" admission slip, so
                the receptionist can double-check them before printing. */}
            <div className="grid grid-cols-2 gap-3 border-b border-border pb-4 text-sm">
              <div className="col-span-2">
                <p className="text-muted-foreground">Họ tên</p>
                <p className="font-medium">{appointment.patientName}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Mã BN - Ngày sinh</p>
                <p className="font-medium">
                  {appointment.patientCode}
                  {patient?.dateOfBirth ? ` - ${formatAppointmentDateOnly(patient.dateOfBirth)}` : ''}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">SĐT</p>
                <p className="font-medium">{patient?.phone ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Địa chỉ</p>
                <p className="font-medium">{patient?.address || '—'}</p>
              </div>
            </div>

            <AppointmentScheduleEditor appointment={appointment} />

            <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">
              Phòng khám sẽ được xác định tự động theo lịch trực của bác sĩ.
            </p>

            {missingAssignment ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">
                  Lịch hẹn này chưa được chỉ định dịch vụ/bác sĩ. Bấm &quot;Chỉnh sửa&quot; ở trên để gán dịch vụ, bác
                  sĩ cho bệnh nhân trước khi check-in.
                </p>
              </div>
            ) : awaitingPayment ? (
              // Payment-before-queue change (2026-08-21): the patient does not
              // enter the doctor's queue until this step succeeds.
              <form className="space-y-4 border-t border-border pt-4" onSubmit={handleConfirmPayment}>
                <p className="text-sm font-semibold text-foreground">Thu phí khám</p>
                {examinationItem ? (
                  <div className="flex items-center justify-between rounded-md border border-border bg-muted p-3">
                    <span className="text-sm text-foreground">{examinationItem.name}</span>
                    <span className="text-base font-bold text-primary">{formatCurrency(examinationItem.amount)}</span>
                  </div>
                ) : (
                  <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                    Lịch hẹn này chưa có khoản phí khám cần thu.
                  </p>
                )}

                {examinationItem && (
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-foreground">Phương thức thanh toán</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                      className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                    >
                      {PAYMENT_METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <Button type="submit" disabled={confirmCheckInPayment.isPending}>
                  {confirmCheckInPayment.isPending
                    ? 'Đang xử lý...'
                    : examinationItem
                      ? 'Thanh toán & Vào hàng chờ'
                      : 'Xác nhận vào hàng chờ'}
                </Button>
              </form>
            ) : (
              <form className="space-y-4 border-t border-border pt-4" onSubmit={handleCheckIn}>
                <p className="text-sm font-semibold text-foreground">Check-in</p>
                <label className="space-y-2 block">
                  <span className="text-sm font-medium text-foreground">Mức ưu tiên</span>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as VisitPriority)}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Payment-collection confirmation, shown up front so it can
                    gate the Check-in button below — the actual invoice isn't
                    created until Check-in is clicked (checkInAppointment),
                    so this only records reception's local confirmation that
                    the fee was collected, and locks in the payment method
                    for the real payment call that follows immediately after. */}
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground">Thanh toán phí khám ban đầu</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Loại phí</p>
                      <p className="font-medium">{appointment.serviceName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Số tiền</p>
                      <p className="text-base font-bold text-primary">
                        {feeService ? formatCurrency(feeService.price) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Trạng thái</p>
                      <Badge variant={feeConfirmedPaid ? 'success' : 'warning'}>
                        {feeConfirmedPaid ? 'Đã thanh toán' : 'Chưa thanh toán'}
                      </Badge>
                    </div>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Phương thức thanh toán</span>
                      <select
                        value={paymentMethod}
                        disabled={feeConfirmedPaid}
                        onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                        className="h-9 w-full rounded-md border border-input bg-white px-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground"
                      >
                        {PAYMENT_METHOD_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Button
                    type="button"
                    variant={feeConfirmedPaid ? 'secondary' : 'primary'}
                    disabled={feeConfirmedPaid}
                    onClick={() => setFeeConfirmedPaid(true)}
                  >
                    {feeConfirmedPaid ? 'Đã xác nhận thanh toán' : 'Thanh toán'}
                  </Button>
                </div>

                {dateMismatch && (
                  <div className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                    <p className="text-sm text-destructive">
                      Chỉ có thể check-in đúng ngày hẹn khám. Bấm &quot;Chỉnh sửa&quot; ở trên để đổi lịch hẹn sang
                      hôm nay trước khi check-in.
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!feeConfirmedPaid || checkInAppointment.isPending || confirmCheckInPayment.isPending}
                  title={!feeConfirmedPaid ? 'Cần xác nhận thanh toán trước khi check-in' : undefined}
                >
                  {checkInAppointment.isPending || confirmCheckInPayment.isPending ? 'Đang xử lý...' : 'Check-in'}
                </Button>
              </form>
            )}
          </div>
        </Card>
      </section>

      <Dialog open={Boolean(queueNumber)} onClose={() => router.push(`/receptionist/appointments/${appointmentId}`)} title="Check-in thành công">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">Số thứ tự của bệnh nhân</p>
          <p className="text-4xl font-bold tracking-wide text-primary">{queueNumber}</p>
          <p className="text-xs text-muted-foreground">Vui lòng ghi lại/thông báo số này cho bệnh nhân trước khi rời màn hình.</p>
          {/* Phiếu khám bệnh đã có sẵn STT (số thứ tự) trong nội dung in — không
              cần in thêm phiếu số thứ tự riêng. Muốn in lại sau, dùng nút ở màn
              chi tiết lịch hẹn (còn khả dụng khi lịch hẹn còn ở trạng thái
              CHECKED_IN). */}
          {checkedInVisitId && (
            <a
              href={visitsApi.printAdmissionSlipUrl(checkedInVisitId)}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="secondary" className="w-full">
                In phiếu khám bệnh
              </Button>
            </a>
          )}
          <Button className="w-full" onClick={() => router.push(`/receptionist/appointments/${appointmentId}`)}>
            Đã xong — về chi tiết lịch hẹn
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
