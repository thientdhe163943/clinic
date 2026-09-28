'use client';

import type { Invoice } from '@/types/invoices';
import { PrintClinicHeader } from './print-clinic-header';
import { PrintPortal } from './print-portal';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ ngân hàng',
  TRANSFER: 'Chuyển khoản',
};

const STATUS_LABEL: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Thanh toán một phần',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Print-only layout for an invoice ("Hóa đơn thanh toán"). Rendered
 * off-screen (hidden on regular display, shown via `@media print`) so the
 * caller can trigger `window.print()` from the invoice detail page without
 * a round-trip to the backend's PDF endpoint — no barcode on this slip.
 * Mirrors `medical-record-print-view.tsx`'s pattern.
 */
export function InvoicePrintView({ data }: { data: Invoice }) {
  return (
    <PrintPortal>
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm text-black">
      <PrintClinicHeader title="Hóa đơn thanh toán" />

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Thông tin hóa đơn</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="font-semibold">Mã hóa đơn: </span>
            {data.invoiceCode}
          </p>
          <p>
            <span className="font-semibold">Họ tên bệnh nhân: </span>
            {data.patientName}
          </p>
          <p>
            <span className="font-semibold">Mã BN: </span>
            {data.patientCode}
          </p>
          <p>
            <span className="font-semibold">Ngày lập: </span>
            {formatDateTime(data.createdAt)}
          </p>
          <p>
            <span className="font-semibold">Trạng thái: </span>
            {STATUS_LABEL[data.paymentStatus] ?? data.paymentStatus}
          </p>
          {data.paymentMethod ? (
            <p>
              <span className="font-semibold">Phương thức thanh toán: </span>
              {METHOD_LABEL[data.paymentMethod] ?? data.paymentMethod}
            </p>
          ) : null}
        </div>
        {data.note ? (
          <p className="mt-1">
            <span className="font-semibold">Ghi chú: </span>
            {data.note}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Chi tiết dịch vụ / sản phẩm</h2>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1">STT</th>
              <th className="border border-black px-2 py-1 text-left">Tên dịch vụ / sản phẩm</th>
              <th className="border border-black px-2 py-1">SL</th>
              <th className="border border-black px-2 py-1">Đơn giá</th>
              <th className="border border-black px-2 py-1">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="border border-black px-2 py-2 text-center text-gray-500">
                  Không có mục nào trong hóa đơn
                </td>
              </tr>
            ) : (
              data.items.map((item, i) => (
                <tr key={item.id}>
                  <td className="border border-black px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-black px-2 py-1">{item.name}</td>
                  <td className="border border-black px-2 py-1 text-center">{item.quantity}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="border border-black px-2 py-1 text-right">{formatCurrency(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="ml-auto max-w-xs space-y-1">
        <div className="flex justify-between">
          <span>Tạm tính</span>
          <span>{formatCurrency(data.subtotal)}</span>
        </div>
        {data.discount > 0 ? (
          <div className="flex justify-between">
            <span>Giảm giá</span>
            <span>- {formatCurrency(data.discount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-black pt-1 font-semibold">
          <span>Tổng cộng</span>
          <span>{formatCurrency(data.total)}</span>
        </div>
        <div className="flex justify-between border border-black px-2 py-1 font-bold">
          <span>Còn phải thanh toán</span>
          <span>{formatCurrency(data.amountDue)}</span>
        </div>
      </section>

      {data.paymentStatus === 'PAID' ? (
        <p className="border border-black px-2 py-2 text-center text-sm font-bold uppercase">
          Đã thanh toán đầy đủ
        </p>
      ) : null}
    </div>
    </PrintPortal>
  );
}
