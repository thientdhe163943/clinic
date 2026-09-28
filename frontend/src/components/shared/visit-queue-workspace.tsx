'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, BellRing, CalendarOff, ChevronRight, Clock, Stethoscope, StickyNote, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { useAuth } from '@/hooks/use-auth';
import { useVisitEvents } from '@/hooks/use-visit-events';
import { useVisits, useNurseQueue, useVisitQueueContext, useCallPatient, useStartVisit, useMarkNoShow } from '@/hooks/use-visits';
import type { VisitListItem, VisitStatus, ShiftType } from '@/types/visits';
import type { VisitPriority } from '@/types/appointments';
import type { ApiError } from '@/types/api';

// Version-up 0.2 item #10 gate #1 — StartVisitUseCase rejects with this code
// (see clinic-backend ExaminationFeeNotPaidError) when the appointment's
// exam-fee InvoiceItem hasn't been collected yet. useStartVisit's own
// onError already toasts `err.message`; this is only used to also flag the
// row inline so the doctor/nurse understands *why* without re-reading the
// toast. There's no in-app link to send them to (the invoice detail page
// lives under /receptionist, which middleware.ts blocks for DOCTOR/NURSE),
// so this stays a plain inline hint rather than a broken navigation link.
const EXAMINATION_FEE_NOT_PAID_CODE = 'MSG_ERR_0143';

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

const priorityLabel: Record<VisitPriority, string> = {
  NORMAL: 'Thường',
  ELDERLY: 'Người cao tuổi',
  PREGNANT: 'Phụ nữ mang thai',
  CHILD: 'Trẻ em',
  EMERGENCY: 'Cấp cứu',
};

const statusFilters: { value: VisitStatus | ''; label: string }[] = [
  { value: '', label: 'Tất cả' },
  { value: 'WAITING', label: 'Đang chờ' },
  { value: 'CALLED', label: 'Đã gọi' },
  { value: 'IN_PROGRESS', label: 'Đang khám' },
  { value: 'AWAITING_RESULTS', label: 'Chờ kết quả CLS' },
  { value: 'COMPLETED', label: 'Hoàn tất' },
  { value: 'NO_SHOW', label: 'Vắng mặt' },
];

function today() {
  // toISOString() converts to UTC first, rolling back to the previous day
  // in UTC+7 during 00:00-07:00 local time — build from local components.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Default the "Ca" filter to whichever shift covers right now, so staff land
// on their own current-shift queue without picking it manually every time.
function currentShiftGuess(): ShiftType {
  return new Date().getHours() < 13 ? 'MORNING' : 'AFTERNOON';
}

const shiftLabel: Record<ShiftType, string> = {
  MORNING: 'Ca sáng',
  AFTERNOON: 'Ca chiều',
  FULL_DAY: 'Cả ngày',
};

const shiftFilters: { value: ShiftType; label: string }[] = [
  { value: 'MORNING', label: 'Ca sáng' },
  { value: 'AFTERNOON', label: 'Ca chiều' },
  { value: 'FULL_DAY', label: 'Cả ngày' },
];

// Version-up 0.2 Phase 2 #9 tình huống A — "trễ Xp" badge, computed at
// render time from Appointment.appointmentTime (no DB column, no new API).
// Only meaningful while the visit is still WAITING/CALLED — once it's
// IN_PROGRESS or later, "late" no longer applies.
const LATE_ELIGIBLE_STATUSES: VisitStatus[] = ['WAITING', 'CALLED'];

function lateMinutes(appointmentTime: string, now: number): number {
  const scheduled = new Date(appointmentTime).getTime();
  if (Number.isNaN(scheduled)) return 0;
  return Math.floor((now - scheduled) / 60_000);
}

// Shared by /doctor/visits (own queue only) and /nurse/queue (every doctor's
// queue, or one doctor's via the extra filter below — a nurse has no queue
// of their own to scope to; backend now supports both, see
// visits.controller.ts `list()`).
export function VisitQueueWorkspace() {
  // Live-refetch the queue when any visit changes elsewhere (another
  // doctor/nurse/receptionist action) — see socket contract in
  // useVisitEvents. Called once here since both /doctor/visits and
  // /nurse/queue render this same shared component.
  useVisitEvents();

  const { user } = useAuth();
  const isNurse = user?.role === 'NURSE';
  const isDoctor = user?.role === 'DOCTOR';

  // Both nurse and doctor queues are same-day operational lists — a date
  // from any other day has no meaning here (no doctor/nurse "queue" exists
  // for a past or future day), so this is fixed to today rather than a
  // user-pickable filter.
  const date = today();
  const [shift, setShift] = useState<ShiftType>(currentShiftGuess());
  const [statusFilter, setStatusFilter] = useState<VisitStatus | ''>('');

  // Ticks every 30s so the "trễ Xp" badge below stays roughly live without a
  // full query refetch — same pattern as the OTP countdown in
  // (public)/guest-booking/page.tsx.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Nurse uses a dedicated endpoint scoped to their assigned room; doctor's
  // own queue is scoped server-side too (see visits.controller.ts `list()`)
  // but doesn't carry room/shift context inline, so it's fetched separately
  // via queue-context for the header/empty-state.
  const { data: nurseQueue, isLoading: nurseLoading } = useNurseQueue(
    isNurse ? (statusFilter || undefined) : undefined,
    isNurse ? shift : undefined,
  );
  const { data: doctorVisits = [], isLoading: doctorLoading } = useVisits(
    !isNurse ? { date: date || undefined, status: statusFilter || undefined, shift } : {},
  );
  const { data: doctorContext } = useVisitQueueContext(
    !isNurse ? { date: date || undefined, shift } : undefined,
  );

  const visits: VisitListItem[] = isNurse ? (nurseQueue?.visits ?? []) : doctorVisits;
  const isLoading = isNurse ? nurseLoading : doctorLoading;
  const roomName = isNurse ? nurseQueue?.roomName : doctorContext?.roomName;
  const hasSchedule = isNurse ? nurseQueue?.roomId != null : doctorContext?.roomId != null;

  const router = useRouter();
  const callPatient = useCallPatient();
  const startVisit = useStartVisit();
  const markNoShow = useMarkNoShow();

  // Which row just got rejected for an unpaid exam fee — cleared on the
  // next attempt (success or a different error) for that same visit.
  const [feeBlockedVisitId, setFeeBlockedVisitId] = useState<string | null>(null);

  const stats = useMemo(() => ({
    waiting: visits.filter((v) => v.status === 'WAITING').length,
    inProgress: visits.filter((v) => v.status === 'IN_PROGRESS').length,
    completed: visits.filter((v) => v.status === 'COMPLETED').length,
  }), [visits]);

  // Most relevant patient currently being called into the room — surfaced
  // in its own card so staff don't have to scan the whole table for it.
  const calledVisit = useMemo(() => visits.find((v) => v.status === 'CALLED') ?? null, [visits]);

  return (
    <main>
      <PageHeader
        title={isNurse ? 'Hàng đợi điều dưỡng' : 'Lượt khám'}
        description={roomName ? `${roomName} · ${shiftLabel[shift]}` : 'Bạn không có ca trực cho khoảng thời gian này'}
      />

      <section className="grid gap-4 p-5 md:grid-cols-3">
        <StatCard icon={Clock} label="Đang chờ" value={String(stats.waiting)} tone="amber" />
        <StatCard icon={Activity} label="Đang khám" value={String(stats.inProgress)} tone="blue" />
        <StatCard icon={Stethoscope} label="Hoàn tất" value={String(stats.completed)} tone="teal" />
      </section>

      {calledVisit && (
        <div className="px-5 pb-1">
          <Card className="flex items-center gap-4 border-primary/40 bg-primary/5 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <BellRing className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">Đang gọi</p>
              <p className="text-sm text-foreground">
                <span className="mr-2 text-xl font-bold text-primary">{calledVisit.queueNumber}</span>
                {calledVisit.patientName}
              </p>
            </div>
          </Card>
        </div>
      )}

      <div className="px-5 pb-5">
        <Card className="overflow-hidden">
          {/* Filter bar — same-day queue for both roles, so only ca + status */}
          <div className="flex flex-wrap gap-3 border-b border-border p-4">
            <Select
              value={shift}
              onChange={(e) => setShift(e.target.value as ShiftType)}
              className="w-32"
            >
              {shiftFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VisitStatus | '')}
              className="w-44"
            >
              {statusFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>

          {/* No schedule state */}
          {!isLoading && !hasSchedule ? (
            <div className="flex flex-col items-center gap-2 p-10 text-muted-foreground">
              <CalendarOff className="h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">Không có lịch trực hôm nay</p>
              <p className="text-xs">Liên hệ quản trị viên để được phân công ca trực.</p>
            </div>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">STT</th>
                  <th className="px-4 py-3 font-medium">Bệnh nhân</th>
                  <th className="px-4 py-3 font-medium">Mã BN</th>
                  <th className="px-4 py-3 font-medium">Bác sĩ</th>
                  <th className="px-4 py-3 font-medium">Ưu tiên</th>
                  <th className="px-4 py-3 font-medium">Dịch vụ</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="min-w-[170px] px-4 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Đang tải...
                    </td>
                  </tr>
                )}
                {!isLoading && visits.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      Không có lượt khám nào
                    </td>
                  </tr>
                )}
                {visits.map((visit: VisitListItem) => (
                  <tr
                    key={visit.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/20 ${
                      visit.priority === 'EMERGENCY'
                        ? 'border-l-4 border-l-destructive bg-destructive/5'
                        : visit.status === 'CALLED'
                          ? 'bg-primary/5'
                          : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-md bg-primary/10 px-2 text-sm font-bold text-primary">
                        {visit.queueNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="flex items-center gap-2">
                        {visit.patientName}
                        {LATE_ELIGIBLE_STATUSES.includes(visit.status) &&
                          lateMinutes(visit.appointmentTime, now) >= 1 && (
                            <Badge variant="warning" title="Đã quá giờ hẹn, bác sĩ có thể đang bận với bệnh nhân khác">
                              Trễ {lateMinutes(visit.appointmentTime, now)}p
                            </Badge>
                          )}
                      </span>
                      {visit.note && (
                        <p
                          className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground"
                          title={visit.note}
                        >
                          <StickyNote className="h-3 w-3 shrink-0" />
                          <span className="line-clamp-1">{visit.note}</span>
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{visit.patientCode}</td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground" title={visit.doctorName}>
                      {visit.doctorName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          visit.priority === 'EMERGENCY' ? 'danger'
                          : visit.priority === 'NORMAL' ? 'default'
                          : 'warning'
                        }
                      >
                        {priorityLabel[visit.priority]}
                      </Badge>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground" title={visit.serviceName}>
                      {visit.serviceName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[visit.status]}>{statusLabel[visit.status]}</Badge>
                    </td>
                    <td className="min-w-[170px] px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Call/no-show — secondary, icon-only actions.
                            Shown by visit status, not by role: backend
                            (`visits.controller.ts`) allows both DOCTOR and
                            NURSE on /call, /start and /no-show, so a doctor
                            can run their own queue end-to-end without
                            needing a nurse to call the patient in first. */}
                        {(visit.status === 'WAITING' || visit.status === 'NO_SHOW' || visit.status === 'CALLED') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Gọi bệnh nhân"
                            onClick={() => callPatient.mutate(visit.id)}
                            disabled={callPatient.isPending}
                          >
                            <BellRing className="h-4 w-4" />
                          </Button>
                        )}
                        {visit.status === 'CALLED' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Không có mặt"
                            className="text-destructive hover:text-destructive"
                            onClick={() => markNoShow.mutate(visit.id)}
                            disabled={markNoShow.isPending}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                        {/* Main action — kept as a clear text CTA
                            (design.md 4.5): the single primary action on
                            the row, needs instant recognition mid-consult,
                            not icon-only. Only a doctor is routed into the
                            exam detail page after starting — that route
                            (/doctor/visits/[id]) is role-gated in
                            middleware.ts and has no nurse equivalent, so a
                            nurse starting a visit just stays on the queue
                            and sees it move to "Đang khám" via refetch. */}
                        {(visit.status === 'CALLED' || visit.status === 'AWAITING_RESULTS') && (
                          <Button
                            size="sm"
                            onClick={() => startVisit.mutate(visit.id, {
                              onSuccess: () => {
                                setFeeBlockedVisitId(null);
                                if (isDoctor) router.push(`/doctor/visits/${visit.id}`);
                              },
                              onError: (err) => {
                                setFeeBlockedVisitId(
                                  (err as ApiError).code === EXAMINATION_FEE_NOT_PAID_CODE ? visit.id : null,
                                );
                              },
                            })}
                            disabled={startVisit.isPending}
                          >
                            Bắt đầu khám
                          </Button>
                        )}
                        {feeBlockedVisitId === visit.id && (
                          <span
                            className="text-xs font-medium text-destructive"
                            title="Bệnh nhân chưa đóng phí khám — liên hệ lễ tân để thu tiền trước khi bắt đầu khám."
                          >
                            Chưa đóng phí khám
                          </span>
                        )}
                        {isDoctor && (
                          <Link href={`/doctor/visits/${visit.id}`}>
                            <Button variant="ghost" size="icon" title="Chi tiết">
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </Card>
      </div>
    </main>
  );
}
