'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, Search, SearchX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { useInvoiceEvents } from '@/hooks/use-invoice-events';
import { useInvoices } from '@/hooks/use-invoices';

function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} đ`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

// Kho tra cứu hóa đơn cũ — chỉ hiện bill đã thu đủ (paymentStatus = PAID).
// Việc thu tiền diễn ra ở luồng check-in (phí khám) và nút "Thanh toán xét
// nghiệm" ở lịch hẹn hôm nay (phí CLS); ở đây chỉ để bệnh nhân đã khám xong
// tìm lại hóa đơn của mình để xem/in.
export default function ReceptionistInvoicesPage() {
  // Live-refetch invoices whenever one changes elsewhere (a CLS fee just
  // collected) — see socket contract in useInvoiceEvents.
  useInvoiceEvents();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Business rule: a receptionist looks up one specific patient's invoice at
  // the counter (by name/patient code/invoice code) rather than browsing the
  // full historical list — so nothing loads until a search term is entered.
  const hasSearched = search.trim().length > 0;

  const query = useMemo(
    () => ({ page, limit: 20, search: search || undefined, paymentStatus: 'PAID' as const }),
    [page, search],
  );

  const { data, isLoading, error } = useInvoices(query, hasSearched);
  const invoices = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="min-h-full bg-background">
      <PageHeader title="Hóa đơn" description="Tra cứu lại hóa đơn đã thanh toán của bệnh nhân đã khám xong" />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
          <form
            className="flex w-full gap-2 md:max-w-sm"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Tìm theo số điện thoại hoặc CCCD"
              />
            </div>
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {hasSearched && <Badge variant="muted">{meta?.total ?? invoices.length} bản ghi</Badge>}
        </div>

        {!hasSearched ? (
          <Card className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Nhập thông tin để tìm hóa đơn</p>
            <p className="text-xs text-muted-foreground">
              Tìm theo số điện thoại hoặc CCCD — danh sách hóa đơn đã thanh toán sẽ hiện ra sau khi tìm kiếm.
            </p>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="h-10 px-4 font-semibold">Mã hóa đơn</th>
                      <th className="h-10 px-4 font-semibold">Bệnh nhân</th>
                      <th className="h-10 px-4 font-semibold">Tổng tiền</th>
                      <th className="h-10 px-4 font-semibold">Ngày thanh toán</th>
                      <th className="h-10 px-4 font-semibold text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="h-20 px-4 text-center text-muted-foreground">
                          Đang tải danh sách hóa đơn...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={5} className="h-20 px-4 text-center text-destructive">
                          Không thể tải dữ liệu hóa đơn.
                        </td>
                      </tr>
                    ) : invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="h-20 px-4 text-center text-muted-foreground">
                          Không có dữ liệu
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t border-border bg-white hover:bg-muted/30">
                          <td className="h-12 px-4 font-medium">{invoice.invoiceCode}</td>
                          <td className="h-12 px-4">
                            <p className="font-medium">{invoice.patientName}</p>
                            <p className="text-xs text-muted-foreground">{invoice.patientCode}</p>
                          </td>
                          <td className="h-12 px-4">{formatCurrency(invoice.total)}</td>
                          <td className="h-12 px-4">{formatDate(invoice.paidAt)}</td>
                          <td className="h-12 px-4">
                            <div className="flex justify-end">
                              <Link
                                href={`/receptionist/invoices/${invoice.appointmentId}`}
                                className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted/80"
                              >
                                <Eye className="mr-1 h-3.5 w-3.5" />
                                Chi tiết
                              </Link>
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
          </>
        )}
      </section>
    </div>
  );
}
