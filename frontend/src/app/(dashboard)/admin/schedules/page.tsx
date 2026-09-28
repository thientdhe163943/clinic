'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Eye, Plus, Rows3, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StaffPicker } from '@/components/shared/staff-picker';
import { useSchedules } from '@/hooks/use-schedules';
import type { UserRole } from '@/types/auth';

const shiftLabels: Record<string, string> = {
  MORNING: 'Sáng',
  AFTERNOON: 'Chiều',
  FULL_DAY: 'Cả ngày',
};

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  LAB_TECH: 'Kỹ thuật viên',
  PATIENT: 'Bệnh nhân',
};

const roleOptions: { value: UserRole | ''; label: string }[] = [
  { value: '', label: 'Tất cả vai trò' },
  { value: 'DOCTOR', label: 'Bác sĩ' },
  { value: 'NURSE', label: 'Điều dưỡng' },
  { value: 'LAB_TECH', label: 'Kỹ thuật viên' },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
}

export default function AdminSchedulesPage() {
  const [staffId, setStaffId] = useState('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const { data: schedules, isLoading, error } = useSchedules(
    {
      userId: staffId || undefined,
      role: role || undefined,
      from: from || undefined,
      to: to || undefined,
    },
    hasSearched,
  );

  const rows = useMemo(() => schedules ?? [], [schedules]);

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Lịch làm việc"
        description="Ca trực bác sĩ, điều dưỡng và kỹ thuật viên."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/schedules/calendar">
              <Button variant="secondary">
                <CalendarDays className="h-4 w-4" />
                Xem lịch tuần
              </Button>
            </Link>
            <Link href="/admin/schedules/bulk">
              <Button variant="secondary">
                <Rows3 className="h-4 w-4" />
                Tạo hàng loạt
              </Button>
            </Link>
            <Link href="/admin/schedules/new">
              <Button>
                <Plus className="h-4 w-4" />
                Tạo lịch
              </Button>
            </Link>
          </div>
        }
      />

      <section className="space-y-4 p-5">
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Nhân sự</span>
              <StaffPicker value={staffId} onChange={setStaffId} allowClear placeholder="Tất cả nhân sự" />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Vai trò</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value as UserRole | '')}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Từ ngày</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Đến ngày</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setHasSearched(true)}>
              <Search className="h-4 w-4" />
              Tìm kiếm
            </Button>
          </div>
        </Card>

        {!hasSearched ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Chọn điều kiện lọc (tuỳ chọn) và bấm &quot;Tìm kiếm&quot; để xem danh sách lịch làm việc.
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="muted">{rows.length} bản ghi</Badge>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] border-collapse text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="h-10 px-4 font-semibold">Nhân sự</th>
                      <th className="h-10 px-4 font-semibold">Vai trò</th>
                      <th className="h-10 px-4 font-semibold">Ngày</th>
                      <th className="h-10 px-4 font-semibold">Ca</th>
                      <th className="h-10 px-4 font-semibold">Phòng</th>
                      <th className="h-10 px-4 font-semibold">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="h-20 px-4 text-center text-muted-foreground">
                          Đang tải danh sách lịch làm việc...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan={6} className="h-20 px-4 text-center text-destructive">
                          Không thể tải dữ liệu lịch làm việc.
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="h-20 px-4 text-center text-muted-foreground">
                          Không tìm thấy lịch làm việc phù hợp.
                        </td>
                      </tr>
                    ) : (
                      rows.map((schedule) => (
                        <tr key={schedule.id} className="border-t border-border bg-white hover:bg-muted/50">
                          <td className="h-12 px-4">{schedule.userName}</td>
                          <td className="h-12 px-4">{roleLabels[schedule.userRole] ?? schedule.userRole}</td>
                          <td className="h-12 px-4">{formatDate(schedule.workDate)}</td>
                          <td className="h-12 px-4">{shiftLabels[schedule.shift] ?? schedule.shift}</td>
                          <td className="h-12 px-4">{schedule.roomCode} - {schedule.roomName}</td>
                          <td className="h-12 px-4">
                            <Link
                              href={`/admin/schedules/${schedule.id}`}
                              className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted/80"
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              Chi tiết
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </section>
    </div>
  );
}
