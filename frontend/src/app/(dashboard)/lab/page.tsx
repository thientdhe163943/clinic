'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/hooks/use-auth';
import { useLabQueue } from '@/hooks/use-cls-orders';
import type { ClsOrder, ClsOrderStatus } from '@/types/cls-orders';

const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// "Hôm nay, 20 Tháng 8" — browser-local date, copied from doctor/page.tsx.
function todayHeaderLabel(): string {
  const now = new Date();
  return `Hôm nay, ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

// Same status → Badge variant/label mapping used in lab/cls-orders/page.tsx —
// kept local since that file doesn't export it.
const statusVariant: Record<ClsOrderStatus, 'warning' | 'default' | 'success' | 'danger'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};
const statusLabel: Record<ClsOrderStatus, string> = {
  PENDING: 'Chờ gọi',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

type TodayFilter = 'ALL' | 'PENDING';

export default function LabHomePage() {
  const { user } = useAuth();

  // useLabQueue resolves to LabQueueResponse ({ orders: ClsOrder[], ... }),
  // not a bare array — reading `.orders` here (previously via a stale
  // useAllClsOrders hook that treated the whole response as the array
  // itself) is what crashed this page with "orders.filter is not a
  // function" on every load.
  const { data } = useLabQueue();
  const orders = useMemo(() => data?.orders ?? [], [data]);

  const stats = useMemo(
    () => ({
      pending: orders.filter((o) => o.status === 'PENDING').length,
      inProgress: orders.filter((o) => o.status === 'IN_PROGRESS').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
    }),
    [orders],
  );

  const inProgressOrder = useMemo<ClsOrder | undefined>(
    () => orders.find((o) => o.status === 'IN_PROGRESS'),
    [orders],
  );

  const pendingOrders = useMemo<ClsOrder[]>(
    () => orders.filter((o) => o.status === 'PENDING'),
    [orders],
  );

  const [filter, setFilter] = useState<TodayFilter>('ALL');
  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [orders],
  );
  const visibleOrders = filter === 'PENDING' ? sortedOrders.filter((o) => o.status === 'PENDING') : sortedOrders;

  return (
    <main>
      <PageHeader
        title={`Chào kỹ thuật viên${user?.fullName ? `, ${user.fullName}` : ''}`}
        description={todayHeaderLabel()}
      />

      <section className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Clock} label="Chờ thực hiện" value={String(stats.pending)} tone="amber" />
        <StatCard icon={FlaskConical} label="Đang thực hiện" value={String(stats.inProgress)} tone="blue" />
        <StatCard icon={CheckCircle2} label="Hoàn tất hôm nay" value={String(stats.completed)} tone="teal" />
      </section>

      <section className="grid gap-4 p-5 pt-0 lg:grid-cols-3">
        {/* Cột trái — Phiếu cận lâm sàng hôm nay (tóm tắt) */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Phiếu cận lâm sàng hôm nay</p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={filter === 'ALL' ? 'primary' : 'secondary'}
                onClick={() => setFilter('ALL')}
              >
                Tất cả
              </Button>
              <Button
                size="sm"
                variant={filter === 'PENDING' ? 'primary' : 'secondary'}
                onClick={() => setFilter('PENDING')}
              >
                Chờ thực hiện
              </Button>
            </div>
          </div>

          {visibleOrders.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {filter === 'PENDING' ? 'Không có phiếu đang chờ thực hiện' : 'Chưa có phiếu cận lâm sàng nào hôm nay'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                    <th className="px-4 py-3 font-medium">Loại dịch vụ CLS</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-foreground">{o.patientName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.serviceName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[o.status]}>{statusLabel[o.status]}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/lab/cls-orders/${o.id}/result`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Chi tiết →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Cột phải — Đang thực hiện / Chờ tiếp theo */}
        <Card className="p-5">
          {inProgressOrder ? (
            <>
              <p className="mb-4 text-sm font-semibold text-foreground">Đang thực hiện</p>
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-base font-semibold text-foreground">{inProgressOrder.patientName}</p>
                  <p className="text-xs text-muted-foreground">Mã bệnh nhân: {inProgressOrder.patientCode}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dịch vụ</p>
                  <p className="text-sm font-medium text-foreground">{inProgressOrder.serviceName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Giờ gọi</p>
                  <p className="text-sm text-foreground">
                    {inProgressOrder.calledAt ? formatTime(inProgressOrder.calledAt) : '—'}
                  </p>
                </div>
                <Link href={`/lab/cls-orders/${inProgressOrder.id}/result`}>
                  <Button className="w-full">
                    <FlaskConical className="h-4 w-4" /> Nhập kết quả
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm font-semibold text-foreground">Chờ tiếp theo</p>
              {pendingOrders.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {pendingOrders.slice(0, 5).map((o) => (
                    <div key={o.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{o.patientName}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.serviceName}</p>
                      </div>
                      <Badge variant={statusVariant[o.status]}>{statusLabel[o.status]}</Badge>
                    </div>
                  ))}
                  <Link href="/lab/cls-orders">
                    <Button variant="secondary" className="w-full">
                      Mở hàng chờ CLS
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <FlaskConical className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Chưa có bệnh nhân đang thực hiện</p>
                  <Link href="/lab/cls-orders">
                    <Button variant="secondary" className="mt-2">
                      Mở hàng chờ CLS
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </Card>
      </section>
    </main>
  );
}
