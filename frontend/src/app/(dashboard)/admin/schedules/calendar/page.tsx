'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { StaffPicker } from '@/components/shared/staff-picker';
import { useReassignScheduleDoctor, useSchedules } from '@/hooks/use-schedules';
import { useStaffOptions } from '@/hooks/use-staff-options';
import type { Schedule } from '@/types/schedules';

// work_schedules.absent_note VARCHAR(255) — see reassign-schedule-doctor.dto.ts.
const MAX_REASON_LENGTH = 255;

const shiftLabels: Record<string, string> = { MORNING: 'Sáng', AFTERNOON: 'Chiều', FULL_DAY: 'Cả ngày' };
const shiftVariant: Record<string, 'default' | 'warning' | 'success'> = {
  MORNING: 'default',
  AFTERNOON: 'warning',
  FULL_DAY: 'success',
};
const weekdayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function toDateOnlyString(date: Date): string {
  // date.toISOString() converts to UTC first, which rolls back to the
  // previous calendar day for any local-midnight Date in a UTC+ timezone
  // (e.g. Vietnam) — shifting both the API query range and the grid's
  // column mapping back by one day. Build the string from local components.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  // Monday-start week: JS getDay() 0=Sun..6=Sat -> offset back to Monday.
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Feature 39 (bổ sung 2026-07-09): xem lịch dạng lưới tuần (nhân sự × thứ)
// thay vì chỉ có bảng danh sách phẳng — giúp Admin nhìn tổng thể ai trực ca
// nào, phòng nào trống trong 1 tuần.
export default function AdminSchedulesCalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart],
  );

  const staffOptions = useStaffOptions();
  const { data: schedules = [], isLoading } = useSchedules({
    from: toDateOnlyString(weekDates[0]),
    to: toDateOnlyString(weekDates[6]),
  });

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, Schedule[]>>();
    for (const schedule of schedules) {
      const dateKey = schedule.workDate.slice(0, 10);
      if (!map.has(schedule.userId)) map.set(schedule.userId, new Map());
      const byDate = map.get(schedule.userId)!;
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey)!.push(schedule);
    }
    return map;
  }, [schedules]);

  const staffWithSchedules = useMemo(() => {
    const idsInGrid = new Set(grid.keys());
    const known: { id: string; fullName: string }[] = staffOptions
      .filter((s) => idsInGrid.has(s.id))
      .map((s) => ({ id: s.id, fullName: s.fullName }));
    const knownIds = new Set(known.map((s) => s.id));
    const unknown: { id: string; fullName: string }[] = [...idsInGrid]
      .filter((id) => !knownIds.has(id))
      .map((id) => ({ id, fullName: schedules.find((s) => s.userId === id)?.userName ?? id }));
    return [...known, ...unknown];
  }, [grid, staffOptions, schedules]);

  const shiftWeek = (deltaDays: number) => {
    setWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + deltaDays));
  };

  // Version-up 0.2 Phase 2 #9 tình huống B — ADMIN marks the doctor on a
  // shift absent and swaps in a substitute (PATCH /schedules/:id/reassign).
  // Only meaningful for DOCTOR shifts (substitute must also be role DOCTOR —
  // see reassign-schedule-doctor.use-case.ts), so the action is only offered
  // on cells belonging to a doctor's schedule.
  const [reassignTarget, setReassignTarget] = useState<Schedule | null>(null);
  const [substituteId, setSubstituteId] = useState('');
  const [reason, setReason] = useState('');
  const reassignDoctor = useReassignScheduleDoctor();

  function openReassign(schedule: Schedule) {
    setReassignTarget(schedule);
    setSubstituteId('');
    setReason('');
  }

  function closeReassign() {
    setReassignTarget(null);
  }

  function submitReassign() {
    if (!reassignTarget || !substituteId || !reason.trim()) return;
    reassignDoctor.mutate(
      { id: reassignTarget.id, input: { substituteDoctorId: substituteId, reason: reason.trim() } },
      { onSuccess: () => closeReassign() },
    );
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Lịch tuần"
        description="Xem tổng thể ca trực của tất cả nhân sự trong tuần."
        action={
          <Link href="/admin/schedules">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <Card className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={() => shiftWeek(-7)}>
            <ChevronLeft className="h-4 w-4" />
            Tuần trước
          </Button>
          <p className="text-sm font-medium text-foreground">
            {weekDates[0].toLocaleDateString('vi-VN')} — {weekDates[6].toLocaleDateString('vi-VN')}
          </p>
          <Button variant="ghost" size="sm" onClick={() => shiftWeek(7)}>
            Tuần sau
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 w-40 px-4 font-semibold">Nhân sự</th>
                  {weekDates.map((date, i) => (
                    <th key={date.toISOString()} className="h-10 px-3 font-semibold">
                      {weekdayLabels[i]}
                      <br />
                      <span className="font-normal normal-case">{date.toLocaleDateString('vi-VN')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="h-20 px-4 text-center text-muted-foreground">
                      Đang tải...
                    </td>
                  </tr>
                ) : staffWithSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="h-20 px-4 text-center text-muted-foreground">
                      Không có ca làm việc nào trong tuần này.
                    </td>
                  </tr>
                ) : (
                  staffWithSchedules.map((staff) => (
                    <tr key={staff.id} className="border-t border-border bg-white align-top">
                      <td className="px-4 py-3 font-medium text-foreground">{staff.fullName}</td>
                      {weekDates.map((date) => {
                        const dateKey = toDateOnlyString(date);
                        const cellSchedules = grid.get(staff.id)?.get(dateKey) ?? [];
                        return (
                          <td key={dateKey} className="px-3 py-3">
                            <div className="flex flex-col gap-1.5">
                              {cellSchedules.map((schedule) => (
                                <div key={schedule.id} className="space-y-0.5">
                                  <div className="flex items-center gap-1">
                                    <Link href={`/admin/schedules/${schedule.id}`} className="min-w-0 flex-1">
                                      <Badge
                                        variant={shiftVariant[schedule.shift] ?? 'default'}
                                        className="w-full justify-center truncate"
                                        title={`${shiftLabels[schedule.shift] ?? schedule.shift} · ${schedule.roomCode}`}
                                      >
                                        {shiftLabels[schedule.shift] ?? schedule.shift} · {schedule.roomCode}
                                      </Badge>
                                    </Link>
                                    {schedule.userRole === 'DOCTOR' && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        title="Đánh dấu vắng & phân công thay thế"
                                        onClick={() => openReassign(schedule)}
                                      >
                                        <UserX className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                  {schedule.isAbsent && (
                                    <Badge
                                      variant="danger"
                                      className="w-full justify-center truncate"
                                      title={`Vắng — thay bởi BS ${schedule.userName}`}
                                    >
                                      Vắng — thay BS {schedule.userName}
                                    </Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <Dialog
        open={!!reassignTarget}
        onClose={closeReassign}
        title="Đánh dấu vắng & phân công thay thế"
        description={
          reassignTarget
            ? `Ca ${shiftLabels[reassignTarget.shift] ?? reassignTarget.shift} ngày ${new Date(reassignTarget.workDate).toLocaleDateString('vi-VN')} — BS ${reassignTarget.userName} tại phòng ${reassignTarget.roomCode}. Mọi lịch hẹn đang chờ/đã xác nhận của ca này sẽ tự động chuyển sang bác sĩ thay thế.`
            : undefined
        }
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Bác sĩ thay thế</span>
            <StaffPicker
              value={substituteId}
              onChange={setSubstituteId}
              roleFilter={['DOCTOR']}
              excludeIds={reassignTarget ? [reassignTarget.userId] : []}
              placeholder="Tìm bác sĩ thay thế..."
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">Lý do vắng mặt</span>
            <textarea
              rows={3}
              value={reason}
              maxLength={MAX_REASON_LENGTH}
              onChange={(event) => setReason(event.target.value)}
              placeholder="VD: Bác sĩ bị ốm đột xuất"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
            <p className="text-right text-xs text-muted-foreground">
              {reason.length}/{MAX_REASON_LENGTH} ký tự
            </p>
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeReassign} disabled={reassignDoctor.isPending}>
              Hủy
            </Button>
            <Button
              type="button"
              onClick={submitReassign}
              disabled={reassignDoctor.isPending || !substituteId || !reason.trim()}
            >
              {reassignDoctor.isPending ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
