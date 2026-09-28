'use client';

import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/hooks/use-auth';
import { useVisits } from '@/hooks/use-visits';
import { formatAppointmentTimeOnly } from '@/lib/utils/appointment-datetime';
import type { VisitListItem, VisitStatus } from '@/types/visits';

// Local (not UTC) today — toISOString() would roll back to the previous
// calendar day in Vietnam's UTC+7 during 00:00-06:59 local time.
function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// "Hôm nay, 20 Tháng 8" — browser-local date, copied from doctor/page.tsx.
function todayHeaderLabel(): string {
  const now = new Date();
  return `Hôm nay, ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

// Same status → Badge variant/label mapping used in doctor/page.tsx,
// visit-queue-workspace.tsx and doctor/visits/[id]/page.tsx (docs/design.md
// mục 5.1) — kept local since neither of those files exports it.
const statusLabel: Record<VisitStatus, string> = {
  WAITING: 'Đang chờ',
  CALLED: 'Đã gọi',
  IN_PROGRESS: 'Đang khám',
  AWAITING_RESULTS: 'Chờ kết quả CLS',
  COMPLETED: 'Hoàn tất',
  NO_SHOW: 'Vắng mặt',
  CANCELLED: 'Đã hủy',
};
const statusVariant: Record<VisitStatus, 'warning' | 'default' | 'success' | 'muted' | 'danger'> = {
  WAITING: 'warning',
  CALLED: 'default',
  IN_PROGRESS: 'default',
  AWAITING_RESULTS: 'muted',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'danger',
};

// 2-letter initials for the round avatar placeholder ("Nguyễn Văn A" -> "NA").
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function PatientAvatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'lg' }) {
  const dimension = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary ${dimension}`}
    >
      {initialsOf(name)}
    </div>
  );
}

type TodayFilter = 'ALL' | 'WAITING';

export default function NurseHomePage() {
  const { user } = useAuth();

  // GET /visits — nurses now share the same visit queue as doctors (không
  // còn khái niệm "bệnh nhân của riêng y tá" tách biệt kể từ version-up 0.2).
  const { data: visits = [] } = useVisits({ date: today() });

  const stats = useMemo(
    () => ({
      waiting: visits.filter((v) => v.status === 'WAITING' || v.status === 'NO_SHOW').length,
      priority: visits.filter((v) => v.priority !== 'NORMAL').length,
      completed: visits.filter((v) => v.status === 'COMPLETED').length,
    }),
    [visits],
  );

  const priorityVisits = useMemo<VisitListItem[]>(
    () => visits.filter((v) => v.priority !== 'NORMAL'),
    [visits],
  );

  const [filter, setFilter] = useState<TodayFilter>('ALL');
  const sortedVisits = useMemo(
    () =>
      [...visits].sort(
        (a, b) => new Date(a.appointmentTime).getTime() - new Date(b.appointmentTime).getTime(),
      ),
    [visits],
  );
  const visibleVisits = filter === 'WAITING' ? sortedVisits.filter((v) => v.status === 'WAITING') : sortedVisits;

  return (
    <main>
      <PageHeader
        title={`Chào điều dưỡng${user?.fullName ? `, ${user.fullName}` : ''}`}
        description={todayHeaderLabel()}
      />

      <section className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Clock} label="Đang chờ" value={String(stats.waiting)} tone="amber" />
        <StatCard icon={Activity} label="Ưu tiên" value={String(stats.priority)} tone="red" />
        <StatCard icon={CheckCircle2} label="Đã xử lý hôm nay" value={String(stats.completed)} tone="teal" />
      </section>

      <section className="grid gap-4 p-5 pt-0 lg:grid-cols-3">
        {/* Cột trái — Hàng đợi hôm nay (tóm tắt) */}
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Hàng đợi hôm nay</p>
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
                variant={filter === 'WAITING' ? 'primary' : 'secondary'}
                onClick={() => setFilter('WAITING')}
              >
                Đang chờ
              </Button>
            </div>
          </div>

          {visibleVisits.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {filter === 'WAITING' ? 'Không có bệnh nhân đang chờ' : 'Chưa có lịch hẹn nào hôm nay'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Giờ</th>
                    <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                    <th className="px-4 py-3 font-medium">Dịch vụ</th>
                    <th className="px-4 py-3 font-medium">Trạng thái</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {visibleVisits.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {formatAppointmentTimeOnly(v.appointmentTime)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PatientAvatar name={v.patientName} size="sm" />
                          <span className="font-medium text-foreground">{v.patientName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{v.serviceName}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusVariant[v.status]}>{statusLabel[v.status]}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link href="/nurse/queue" className="text-sm font-medium text-primary hover:underline">
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

        {/* Cột phải — Cần chú ý (ưu tiên) */}
        <Card className="p-5">
          <p className="mb-4 text-sm font-semibold text-foreground">Cần chú ý</p>
          {priorityVisits.length > 0 ? (
            <div className="flex flex-col gap-3">
              {priorityVisits.map((v) => (
                <div key={v.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                  <PatientAvatar name={v.patientName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{v.patientName}</p>
                    <p className="text-xs text-muted-foreground">{v.serviceName}</p>
                  </div>
                  <Badge variant="danger">{v.priority}</Badge>
                </div>
              ))}
              <Link href="/nurse/queue">
                <Button variant="secondary" className="w-full">
                  Mở hàng đợi điều dưỡng
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Không có ca ưu tiên nào hôm nay</p>
              <Link href="/nurse/queue">
                <Button variant="secondary" className="mt-2">
                  Mở hàng đợi điều dưỡng
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </section>
    </main>
  );
}
