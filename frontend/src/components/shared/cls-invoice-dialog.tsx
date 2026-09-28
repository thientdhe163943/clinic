'use client';

import { useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { useInvoiceByAppointment, usePayInvoice } from '@/hooks/use-invoices';
import { usePatient } from '@/hooks/use-patients';
import { PrintPortal } from '@/components/shared/print-portal';
import { useAuthStore } from '@/stores/auth.store';
import { vndAmountToWords } from '@/lib/utils/number-to-words';
import type { Appointment } from '@/types/appointments';
import type { InvoiceItem, PaymentMethod } from '@/types/invoices';

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'CARD', label: 'Thẻ ngân hàng' },
  { value: 'TRANSFER', label: 'Chuyển khoản' },
];

const GENDER_LABEL: Record<string, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// Plain thousands-separated number, no currency symbol — matches the
// clinic's real "Phiếu thu chi tiết" slip, whose columns are already
// labeled "(đồng)" instead of using vi-VN's period-separated currency format.
function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

function calcAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

function formatReceiptDateTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} Ngày ${dd} tháng ${mo} năm ${date.getFullYear()}`;
}

interface PaidSnapshot {
  items: InvoiceItem[];
  total: number;
  paymentMethod: PaymentMethod;
  paidAt: Date;
}

// Reception's entry point to collect a CLS (cận lâm sàng) fee the doctor
// billed mid-visit (see CreateClsOrderUseCase) — lists just the unpaid CLS
// lines from the appointment's invoice (already created at check-in), takes
// a payment method, then prints a detailed payment receipt ("Phiếu thu chi
// tiết", matching the clinic's real paper slip format). Reuses the same
// PayInvoiceUseCase the full invoice detail page uses — just scoped to this
// one appointment's CLS items instead of the whole invoice.
//
// After payment succeeds the dialog switches to a "Thanh toán thành công"
// state; the receipt is only sent to the printer when the receptionist
// clicks "In phiếu thu" (auto-printing on success raced the receipt DOM /
// clinic + patient queries and printed a blank page).
//
// Deliberately does NOT reuse InvoicePrintView: that renders the whole
// invoice (exam fee included), but this receipt is only for the CLS fee
// being collected right now — the exam fee was already billed/printed
// separately at check-in and must not appear (or be re-summed) here.
export function ClsInvoiceDialog({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const { data: invoice, isLoading } = useInvoiceByAppointment(appointment.id);
  const { data: patient } = usePatient(appointment.patientId);
  const { data: clinicInfo } = useClinicInfo();
  const currentUserName = useAuthStore((s) => s.user?.fullName);
  const payInvoice = usePayInvoice();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidSnapshot, setPaidSnapshot] = useState<PaidSnapshot | null>(null);

  const clsItems = (invoice?.items ?? []).filter((item) => item.itemType === 'CLS' && !item.paidAt);
  const total = clsItems.reduce((sum, item) => sum + item.amount, 0);

  const handlePay = () => {
    if (!invoice || clsItems.length === 0) return;
    payInvoice.mutate(
      { id: invoice.id, data: { paymentMethod, itemIds: clsItems.map((item) => item.id) } },
      // Snapshot exactly what was paid just now — `invoice` refetches after
      // this (its items now show paidAt), so the receipt below reads from
      // this fixed copy instead of the live (changing) query data.
      { onSuccess: () => setPaidSnapshot({ items: clsItems, total, paymentMethod, paidAt: new Date() }) },
    );
  };

  const age = patient ? calcAge(patient.dateOfBirth) : null;
  const genderText = patient ? (GENDER_LABEL[patient.gender] ?? patient.gender) : '';

  return (
    <Dialog open onClose={onClose} title="Lập hóa đơn — Xét nghiệm cận lâm sàng">
      {paidSnapshot ? (
        <div className="space-y-4 text-center">
          <p className="text-sm font-medium text-emerald-700">Thanh toán thành công.</p>
          <Button variant="secondary" className="w-full" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            In phiếu thu
          </Button>
          <Button className="w-full" onClick={onClose}>
            Đóng
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Các dịch vụ cận lâm sàng bác sĩ chỉ định cho {appointment.patientName}:
          </p>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : clsItems.length === 0 ? (
            <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
              Không có dịch vụ cận lâm sàng nào cần thanh toán.
            </p>
          ) : (
            <div className="space-y-2">
              {clsItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted p-3"
                >
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(item.amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-sm font-semibold text-foreground">Tổng cộng</span>
                <span className="text-base font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {clsItems.length > 0 && (
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

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={payInvoice.isPending}>
              Hủy
            </Button>
            <Button disabled={clsItems.length === 0 || payInvoice.isPending} onClick={handlePay}>
              {payInvoice.isPending ? 'Đang xử lý...' : 'Thanh toán'}
            </Button>
          </div>
        </div>
      )}

      {paidSnapshot && (
        <PrintPortal>
        <div className="mx-auto max-w-3xl space-y-3 bg-white p-6 text-sm text-black">
          {/* Two equal-width flanking columns (1fr each) with the title as
              the fixed-width middle one — that's what keeps the title
              geometrically centered on the page regardless of how much text
              is in the clinic-name column, without resorting to absolute
              positioning. A plain 3-equal-column grid (tried earlier) instead
              squeezed the clinic name into a fixed 1/3 width, forcing it to
              wrap across 3 lines. */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 border-b border-black pb-2">
            <div className="text-[10px] leading-snug">
              <p className="font-semibold uppercase">{clinicInfo?.name}</p>
              {clinicInfo?.address ? <p>{clinicInfo.address}</p> : null}
            </div>
            <h1 className="whitespace-nowrap text-base font-bold uppercase">Phiếu thu chi tiết</h1>
            <div />
          </div>

          <section className="space-y-1">
            <p>
              <span className="font-semibold">- Họ tên người bệnh: </span>
              {appointment.patientName.toUpperCase()}
              {age != null ? <span>&nbsp;&nbsp;&nbsp;Tuổi: {age}</span> : null}
              {genderText ? <span>&nbsp;&nbsp;&nbsp;{genderText}</span> : null}
            </p>
            <p>
              <span className="font-semibold">- Mã người bệnh: </span>
              {appointment.patientCode}
            </p>
            {patient?.address ? (
              <p>
                <span className="font-semibold">- Địa chỉ: </span>
                {patient.address}
              </p>
            ) : null}
            <p>
              <span className="font-semibold">- Đối tượng: </span>
              Yêu cầu
            </p>
            <p>
              <span className="font-semibold">- Khoa phòng: </span>
              {appointment.roomName ?? '—'} ({appointment.doctorName})
            </p>
            <p>
              <span className="font-semibold">- Lý do thu: </span>
              Cận lâm sàng: {formatNumber(paidSnapshot.total)}đ
            </p>
          </section>

          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1" rowSpan={2}>
                  Tên dịch vụ
                </th>
                <th className="border border-black px-2 py-1" rowSpan={2}>
                  Đơn vị tính
                </th>
                <th className="border border-black px-2 py-1" rowSpan={2}>
                  Số lượng
                </th>
                <th className="border border-black px-2 py-1" rowSpan={2}>
                  Đơn giá (đồng)
                </th>
                <th className="border border-black px-2 py-1" rowSpan={2}>
                  Thành tiền (đồng)
                </th>
                <th className="border border-black px-2 py-1">Nguồn thanh toán (đồng)</th>
              </tr>
              <tr>
                <th className="border border-black px-2 py-1">Người bệnh</th>
              </tr>
            </thead>
            <tbody>
              {paidSnapshot.items.map((item) => (
                <tr key={item.id}>
                  <td className="border border-black px-2 py-1 text-left">{item.name}</td>
                  <td className="border border-black px-2 py-1 text-center">Lần</td>
                  <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatNumber(item.unitPrice)}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatNumber(item.amount)}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatNumber(item.amount)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="border border-black px-2 py-1 text-right" colSpan={4}>
                  Tổng tiền
                </td>
                <td className="border border-black px-2 py-1 text-right">{formatNumber(paidSnapshot.total)}</td>
                <td className="border border-black px-2 py-1 text-right">{formatNumber(paidSnapshot.total)}</td>
              </tr>
            </tbody>
          </table>

          <div className="space-y-0.5">
            <p>
              <span className="font-semibold">- Số tiền: </span>
              {formatNumber(paidSnapshot.total)} đồng
            </p>
            <p>
              <span className="font-semibold">- Bằng chữ: </span>
              {vndAmountToWords(paidSnapshot.total)}
            </p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-4 text-center text-xs">
            <div>
              <p className="font-semibold text-black">Người nộp</p>
              <p className="mt-10 text-gray-600">Họ tên: ..............................</p>
            </div>
            <div>
              <p>{formatReceiptDateTime(paidSnapshot.paidAt)}</p>
              <p className="font-semibold text-black">Người lập phiếu</p>
              <p className="mt-8 text-gray-600">(Ký và ghi rõ họ tên)</p>
              <p className="mt-1 font-semibold text-black">{currentUserName}</p>
            </div>
          </div>
        </div>
        </PrintPortal>
      )}
    </Dialog>
  );
}
