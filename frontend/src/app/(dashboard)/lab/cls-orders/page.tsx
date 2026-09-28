'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff, FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useClsOrderEvents } from '@/hooks/use-cls-order-events';
import { useLabQueue, useCallPatientGroupToCls } from '@/hooks/use-cls-orders';
import type { ClsOrder, ClsOrderStatus } from '@/types/cls-orders';

const STATUS_OPTIONS: { value: ClsOrderStatus; label: string }[] = [
  { value: 'PENDING', label: 'Chờ gọi' },
  { value: 'IN_PROGRESS', label: 'Đang thực hiện' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

interface PatientGroup {
  visitId: string;
  patientName: string;
  patientCode: string;
  doctorName: string;
  createdAt: string;
  orders: ClsOrder[];
}

function groupByVisit(orders: ClsOrder[]): PatientGroup[] {
  const map = new Map<string, PatientGroup>();
  for (const order of orders) {
    const existing = map.get(order.visitId);
    if (existing) {
      existing.orders.push(order);
      // keep earliest createdAt as group time
      if (order.createdAt < existing.createdAt) existing.createdAt = order.createdAt;
    } else {
      map.set(order.visitId, {
        visitId: order.visitId,
        patientName: order.patientName,
        patientCode: order.patientCode,
        doctorName: order.doctorName,
        createdAt: order.createdAt,
        orders: [order],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ─── Patient group card ────────────────────────────────────────────────────────

function PatientGroupCard({
  group,
  index,
  otherPatientInProgress,
}: {
  group: PatientGroup;
  index: number;
  otherPatientInProgress: boolean;
}) {
  const router = useRouter();
  const callGroup = useCallPatientGroupToCls();

  const pendingIds = group.orders.filter((o) => o.status === 'PENDING').map((o) => o.id);
  const hasPending = pendingIds.length > 0;
  const hasInProgress = group.orders.some((o) => o.status === 'IN_PROGRESS');

  const groupStatus: ClsOrderStatus = hasInProgress
    ? 'IN_PROGRESS'
    : group.orders.every((o) => o.status === 'COMPLETED')
      ? 'COMPLETED'
      : group.orders.every((o) => o.status === 'CANCELLED')
        ? 'CANCELLED'
        : 'PENDING';

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-foreground">{group.patientName}</p>
            <p className="text-xs text-muted-foreground">
              {group.patientCode} · {group.doctorName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[groupStatus]}>{statusLabel[groupStatus]}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">{formatTime(group.createdAt)}</span>
        </div>
      </div>

      {/* Service rows */}
      <div className="divide-y divide-border">
        {group.orders.map((order) => (
          <div key={order.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span className="text-sm text-foreground">{order.serviceName}</span>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant[order.status]}>{statusLabel[order.status]}</Badge>
              {order.status === 'IN_PROGRESS' && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/lab/cls-orders/${order.id}/result`)}
                >
                  Nhập kết quả
                </Button>
              )}
              {order.status === 'COMPLETED' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/lab/cls-orders/${order.id}/result`)}
                >
                  Xem kết quả
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer — "Gọi BN" only when there are pending orders */}
      {hasPending && (
        <div className="flex justify-end border-t border-border px-4 py-2.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={callGroup.isPending || otherPatientInProgress}
            title={otherPatientInProgress ? 'Đang có bệnh nhân khác trong phòng' : undefined}
            onClick={() => callGroup.mutate(pendingIds)}
          >
            Gọi BN vào
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LabClsOrdersPage() {
  useClsOrderEvents();

  const [selectedStatuses, setSelectedStatuses] = useState<ClsOrderStatus[]>(['PENDING', 'IN_PROGRESS']);

  const { data, isLoading } = useLabQueue({ statuses: selectedStatuses });

  const clsRoomName = data?.clsRoomName ?? null;
  const hasSchedule = data?.clsRoomId !== null && data?.clsRoomId !== undefined;
  const orders = data?.orders ?? [];

  const groups = groupByVisit(orders);

  // True if any group OTHER than the one being evaluated has an IN_PROGRESS order
  function otherPatientInProgress(visitId: string) {
    return orders.some((o) => o.status === 'IN_PROGRESS' && o.visitId !== visitId);
  }

  function toggleStatus(s: ClsOrderStatus) {
    setSelectedStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  return (
    <main>
      <PageHeader
        title="Hàng chờ CLS"
        description={clsRoomName ? `${clsRoomName} — hôm nay` : 'Phiếu cận lâm sàng'}
      />

      <section className="space-y-4 p-5">
        {/* Status filter — bounded toolbar so it reads as one control group
            instead of buttons floating loose on the page background, with
            a count badge on the right matching the list-page filter-bar
            convention (design.md 4.1). */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatus(opt.value)}
                className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                  selectedStatuses.includes(opt.value)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {!isLoading && hasSchedule && <Badge variant="muted">{groups.length} bệnh nhân</Badge>}
        </div>

        {/* Content */}
        {isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Đang tải...</Card>
        ) : !hasSchedule ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
            <CalendarOff className="h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">Không có lịch trực hôm nay</p>
            <p className="text-xs">Liên hệ quản trị viên để được phân công ca trực.</p>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
            <FlaskConical className="h-8 w-8 opacity-40" />
            <p className="text-sm">Không có phiếu nào</p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group, idx) => (
              <PatientGroupCard
                key={group.visitId}
                group={group}
                index={idx}
                otherPatientInProgress={otherPatientInProgress(group.visitId)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
