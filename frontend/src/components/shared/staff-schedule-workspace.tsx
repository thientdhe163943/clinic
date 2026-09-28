'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/hooks/use-auth';
import { useSchedules } from '@/hooks/use-schedules';

const shiftLabels: Record<string, string> = { MORNING: 'Sáng', AFTERNOON: 'Chiều', FULL_DAY: 'Cả ngày' };
const shiftVariant: Record<string, 'default' | 'warning' | 'success'> = {
  MORNING: 'default',
  AFTERNOON: 'warning',
  FULL_DAY: 'success',
};
const weekdayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

// Same "read local components directly" fix as admin/schedules/calendar —
// toISOString() would roll back to the previous day in UTC+7.
function toDateOnlyString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Grid view of the logged-in staff member's own week — same layout as
// admin/schedules/calendar, minus the per-staff row dimension. Explicitly
// passes `userId: user.id` rather than relying on the backend to infer
// "just me" from an absent userId param — that inference only holds for
// roles ListSchedulesUseCase force-scopes (DOCTOR/NURSE/LAB_TECH); since
// version-up 0.2 #4 gave RECEPTIONIST the same unrestricted userId/role
// filtering ADMIN has (for the reception overview grid, which deliberately
// queries every doctor's schedule), an unscoped call from this "my own
// week" view would silently return every staff member's schedule for a
// RECEPTIONIST caller instead of just their own.
export function StaffScheduleWorkspace({ title }: { title: string }) {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    [weekStart],
  );

  const { data: schedules = [], isLoading } = useSchedules({
    userId: user?.id,
    from: toDateOnlyString(weekDates[0]),
    to: toDateOnlyString(weekDates[6]),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, typeof schedules>();
    for (const schedule of schedules) {
      const dateKey = schedule.workDate.slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(schedule);
    }
    return map;
  }, [schedules]);

  const shiftWeek = (deltaDays: number) => {
    setWeekStart((prev) => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + deltaDays));
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader title={title} description="Ca làm việc và phòng được phân công cho bạn." />

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
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  {weekDates.map((date, i) => (
                    <th key={date.toISOString()} className="h-10 w-1/7 px-3 font-semibold">
                      {weekdayLabels[i]}
                      <br />
                      <span className="font-normal normal-case">{date.toLocaleDateString('vi-VN')}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-white align-top">
                  {isLoading ? (
                    <td colSpan={7} className="h-24 px-4 text-center text-muted-foreground">
                      Đang tải...
                    </td>
                  ) : (
                    weekDates.map((date) => {
                      const dateKey = toDateOnlyString(date);
                      const cellSchedules = byDate.get(dateKey) ?? [];
                      return (
                        <td key={dateKey} className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            {cellSchedules.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              cellSchedules.map((schedule) => (
                                <Badge
                                  key={schedule.id}
                                  variant={shiftVariant[schedule.shift] ?? 'default'}
                                  className="w-full justify-center"
                                >
                                  {shiftLabels[schedule.shift] ?? schedule.shift} · {schedule.roomCode}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                      );
                    })
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
