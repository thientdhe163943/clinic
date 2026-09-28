'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Printer, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useInvoiceByAppointment } from '@/hooks/use-invoices';
import { useInvoiceEvents } from '@/hooks/use-invoice-events';
import { InvoicePrintView } from '@/components/shared/invoice-print-view';
import type { InvoiceItemType, PaymentMethod, PaymentStatus } from '@/types/invoices';

const STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
};

const STATUS_VARIANT: Record<PaymentStatus, 'muted' | 'warning' | 'success' | 'danger'> = {
  UNPAID: 'warning',
  PARTIALLY_PAID: 'warning',
  PAID: 'success',
  CANCELLED: 'danger',
};

const ITEM_TYPE_LABEL: Record<InvoiceItemType, string> = {
  SERVICE: 'Dịch vụ',
  CLS: 'Cận lâm sàng',
  MEDICINE: 'Thuốc',
};

const ITEM_TYPE_COLOR: Record<InvoiceItemType, string> = {
  SERVICE: 'bg-blue-50 text-blue-700',
  CLS: 'bg-purple-50 text-purple-700',
  MEDICINE: 'bg-emerald-50 text-emerald-700',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ ngân hàng',
  TRANSFER: 'Chuyển khoản',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// Read-only "xem lại bill đã thanh toán" screen. Tiền được thu ở 2 chỗ khác:
// phí khám lần đầu tại luồng check-in (ConfirmCheckInPaymentUseCase) và phí
// cận lâm sàng tại nút "Thanh toán xét nghiệm" ở lịch hẹn hôm nay
// (ClsInvoiceDialog). Trang này chỉ để bệnh nhân đã khám xong tra lại hóa
// đơn cũ + in — không có thao tác thu tiền.
export default function ReceptionistInvoiceDetailPage() {
  const params = useParams();
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] : params.appointmentId;

  // Live-refetch while this invoice is open — a CLS fee collected from
  // another screen fires `invoice:changed` (see use-invoice-events.ts) and
  // should reflect here without a manual reload.
  useInvoiceEvents();

  const { data: invoice, isLoading, error } = useInvoiceByAppointment(appointmentId);

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        Đang tải hóa đơn...
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="p-5">
        <Link href="/receptionist/invoices">
          <Button variant="ghost" className="mb-4 -ml-2">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Trở về danh sách
          </Button>
        </Link>
        <p className="text-sm text-destructive">Lịch hẹn này chưa có hóa đơn, hoặc đã xảy ra lỗi khi tải dữ liệu.</p>
      </div>
    );
  }

  const isPaid = invoice.paymentStatus === 'PAID';

  return (
    <div className="min-h-full bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-white px-5 py-3">
        <Link href="/receptionist/invoices">
          <Button variant="ghost" className="-ml-2">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Danh sách hóa đơn
          </Button>
        </Link>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          In hóa đơn
        </Button>
      </div>

      <div className="mx-auto max-w-2xl p-5">
        <Card className="overflow-hidden">
          {/* ── Invoice header ── */}
          <div className="border-b border-border bg-white px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phiếu thu</p>
                  <p className="text-xl font-bold text-foreground">{invoice.invoiceCode}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={STATUS_VARIANT[invoice.paymentStatus]} className="text-sm px-3 py-1">
                  {STATUS_LABEL[invoice.paymentStatus]}
                </Badge>
                {isPaid && invoice.paidAt && (
                  <p className="mt-1 text-xs text-muted-foreground">Thanh toán lúc {formatDateTime(invoice.paidAt)}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Patient & invoice info ── */}
          <div className="grid grid-cols-2 gap-px bg-border">
            <div className="bg-white px-6 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bệnh nhân</p>
              <p className="font-semibold text-foreground">{invoice.patientName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Mã: {invoice.patientCode}</p>
            </div>
            <div className="bg-white px-6 py-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thông tin hóa đơn</p>
              <p className="text-sm text-muted-foreground">
                Ngày lập: <span className="font-medium text-foreground">{formatDateTime(invoice.createdAt)}</span>
              </p>
              {invoice.paymentMethod && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Thanh toán: <span className="font-medium text-foreground">{METHOD_LABEL[invoice.paymentMethod]}</span>
                </p>
              )}
            </div>
          </div>

          {/* ── Items table ── */}
          <div className="bg-white">
            <div className="px-6 pt-5 pb-1">
              <p className="text-sm font-semibold text-foreground">Chi tiết dịch vụ</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/50">
                    <th className="h-9 px-6 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Tên dịch vụ / sản phẩm
                    </th>
                    <th className="h-9 px-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Loại
                    </th>
                    <th className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      SL
                    </th>
                    <th className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Đơn giá
                    </th>
                    <th className="h-9 px-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Thành tiền
                    </th>
                    <th className="h-9 px-6 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                        Không có mục nào trong hóa đơn
                      </td>
                    </tr>
                  ) : (
                    invoice.items.map((item, idx) => {
                      const isItemPaid = item.paidAt != null;
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-border last:border-0 ${idx % 2 === 1 ? 'bg-muted/20' : 'bg-white'}`}
                        >
                          <td className="h-12 px-6 font-medium text-foreground">{item.name}</td>
                          <td className="h-12 px-3">
                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${ITEM_TYPE_COLOR[item.itemType]}`}>
                              {ITEM_TYPE_LABEL[item.itemType]}
                            </span>
                          </td>
                          <td className="h-12 px-3 text-right text-muted-foreground">{item.quantity}</td>
                          <td className="h-12 px-3 text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                          <td className="h-12 px-3 text-right font-semibold text-foreground">{formatCurrency(item.amount)}</td>
                          <td className="h-12 px-6">
                            <Badge variant={isItemPaid ? 'success' : 'warning'}>
                              {isItemPaid ? 'Đã thu' : 'Chưa thu'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Totals ── */}
          <div className="border-t border-border bg-white px-6 py-5">
            <div className="ml-auto max-w-xs space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Giảm giá</span>
                  <span className="text-emerald-600">- {formatCurrency(invoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>Tổng cộng</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-primary/5 px-3 py-2.5">
                <span className="font-semibold text-primary">
                  {isPaid ? 'Đã thanh toán' : 'Còn phải thu'}
                </span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(isPaid ? invoice.total : invoice.amountDue)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Paid confirmation banner ── */}
          {isPaid && (
            <div className="flex items-center gap-3 border-t border-emerald-100 bg-emerald-50 px-6 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <span className="font-semibold text-emerald-800">Đã thanh toán đầy đủ</span>
                {invoice.paymentMethod && (
                  <span className="ml-2 text-emerald-700">qua {METHOD_LABEL[invoice.paymentMethod]}</span>
                )}
                {invoice.paidAt && (
                  <span className="ml-2 text-emerald-600">• {formatDateTime(invoice.paidAt)}</span>
                )}
              </div>
            </div>
          )}

          {/* ── Note ── */}
          {invoice.note && (
            <div className="border-t border-border bg-amber-50 px-6 py-3 text-sm text-amber-800">
              <span className="font-medium">Ghi chú:</span> {invoice.note}
            </div>
          )}
        </Card>
      </div>

      <InvoicePrintView data={invoice} />
    </div>
  );
}
