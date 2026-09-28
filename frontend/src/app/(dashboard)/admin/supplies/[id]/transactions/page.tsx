'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { ViewFullTextButton } from '@/components/shared/view-full-text-button';
import { useSupplyTransactions } from '@/hooks/use-supplies';
import type { SupplyTransactionType } from '@/types/supplies';

const typeLabel: Record<SupplyTransactionType, string> = {
  IMPORT: 'Nhập kho',
  DISTRIBUTE: 'Phân phối',
  RETURN: 'Hoàn trả',
};

const typeBadgeVariant: Record<SupplyTransactionType, 'success' | 'warning' | 'default'> = {
  IMPORT: 'success',
  DISTRIBUTE: 'warning',
  RETURN: 'default',
};

function formatDateTime(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN');
}

export default function SupplyTransactionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const supplyId = Array.isArray(params.id) ? params.id[0] : params.id;
  const supplyName = searchParams.get('name');
  const supplyUnit = searchParams.get('unit');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [type, setType] = useState<SupplyTransactionType | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error } = useSupplyTransactions(supplyId, {
    from: from || undefined,
    to: to || undefined,
    type: type || undefined,
    page,
    limit: 10,
  });

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={supplyName ? `Lịch sử giao dịch — ${supplyName}` : 'Lịch sử giao dịch vật tư'}
        description="Nhập kho, phân phối và hoàn trả theo thời gian"
        action={
          <Link href="/admin/supplies">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Trở về danh sách
            </Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Từ ngày</label>
            <input
              type="date"
              value={from}
              onChange={(e) => { setPage(1); setFrom(e.target.value); }}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Đến ngày</label>
            <input
              type="date"
              value={to}
              onChange={(e) => { setPage(1); setTo(e.target.value); }}
              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Loại giao dịch</label>
            <Select
              className="sm:w-48"
              value={type}
              onChange={(e) => { setPage(1); setType(e.target.value as SupplyTransactionType | ''); }}
            >
              <option value="">Tất cả loại</option>
              <option value="IMPORT">Nhập kho</option>
              <option value="DISTRIBUTE">Phân phối</option>
              <option value="RETURN">Hoàn trả</option>
            </Select>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Thời gian</th>
                  <th className="h-10 px-4 font-semibold">Loại giao dịch</th>
                  <th className="h-10 px-4 font-semibold">Số lượng</th>
                  <th className="h-10 px-4 font-semibold">Phòng</th>
                  <th className="h-10 px-4 font-semibold">Người thực hiện</th>
                  <th className="h-10 px-4 font-semibold">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={6} className="h-32 text-center text-muted-foreground">Đang tải...</td></tr>
                )}
                {isError && (
                  <tr><td colSpan={6} className="h-32 text-center text-destructive">Lỗi tải dữ liệu: {error?.message ?? 'Vui lòng thử lại'}</td></tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr><td colSpan={6} className="h-32 text-center text-muted-foreground">Không có dữ liệu</td></tr>
                )}
                {items.map((tx) => (
                  <tr key={tx.id} className="border-t border-border bg-white">
                    <td className="h-12 px-4 text-muted-foreground">{formatDateTime(tx.createdAt)}</td>
                    <td className="h-12 px-4"><Badge variant={typeBadgeVariant[tx.transactionType]}>{typeLabel[tx.transactionType]}</Badge></td>
                    <td className={`h-12 px-4 tabular-nums font-medium ${tx.quantity < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                      {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                      {supplyUnit ? ` ${supplyUnit}` : ''}
                    </td>
                    <td className="h-12 px-4 text-muted-foreground">{tx.roomName ?? '—'}</td>
                    <td className="h-12 px-4">{tx.actorName}</td>
                    <td className="h-12 px-4 max-w-[240px] text-muted-foreground">
                      {tx.note ? (
                        <div className="flex items-center gap-1">
                          <span className="truncate">{tx.note}</span>
                          <ViewFullTextButton label="Ghi chú giao dịch" text={tx.note} />
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
      </section>
    </div>
  );
}
