'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useNotificationStore } from '@/stores/notification.store';
import { useCreateSchedule, useSchedules } from '@/hooks/use-schedules';
import { useRooms } from '@/hooks/use-rooms';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { getScheduleDatePickerGridRange, ScheduleDatePicker } from '@/components/shared/schedule-date-picker';
import { StaffPicker } from '@/components/shared/staff-picker';
import { useStaffOptions } from '@/hooks/use-staff-options';
import { todayDateString } from '@/lib/utils/date';
import type { ShiftType } from '@/types/schedules';

const shiftOptions: { value: ShiftType; label: string }[] = [
  { value: 'MORNING', label: 'Sáng' },
  { value: 'AFTERNOON', label: 'Chiều' },
  { value: 'FULL_DAY', label: 'Cả ngày' },
];

// Mirrors clinic_system's domain/services/shift-overlap.util.ts — FULL_DAY
// spans the same real hours as MORNING+AFTERNOON combined, so it conflicts
// with both; MORNING and AFTERNOON don't conflict with each other.
const OVERLAPPING_SHIFTS: Record<ShiftType, ShiftType[]> = {
  MORNING: ['MORNING', 'FULL_DAY'],
  AFTERNOON: ['AFTERNOON', 'FULL_DAY'],
  FULL_DAY: ['MORNING', 'AFTERNOON', 'FULL_DAY'],
};

export default function AdminSchedulesCreatePage() {
  const [userId, setUserId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [shift, setShift] = useState<ShiftType>('MORNING');
  const [roomId, setRoomId] = useState('');
  const [note, setNote] = useState('');

  const pushToast = useNotificationStore((state) => state.push);
  const createSchedule = useCreateSchedule();
  const { data: rooms } = useRooms();
  const staffOptions = useStaffOptions();

  const selectedStaff = useMemo(
    () => staffOptions.find((u) => u.id === userId) ?? null,
    [staffOptions, userId],
  );
  const selectedUserRole = selectedStaff?.role ?? null;

  const eligibleRooms = useMemo(() => {
    return (rooms ?? []).filter((room) => {
      if (room.status !== 'ACTIVE') return false;
      if (selectedUserRole === 'LAB_TECH') {
        if (room.type !== 'CLS') return false;
      } else if (selectedUserRole === 'RECEPTIONIST' || selectedUserRole === 'ADMIN') {
        if (room.type !== 'ADMIN') return false;
      } else if (selectedUserRole !== null) {
        if (room.type !== 'EXAMINATION') return false;
      } else if (room.type !== 'EXAMINATION' && room.type !== 'CLS') {
        return false;
      }
      // Additional narrowing on top of the role→type filter above: when the
      // selected staff member has a specialty, only show rooms that declare
      // the same specialty. No specialty on the staff yet -> don't hard
      // block, fall back to the role→type result (not everyone has a
      // specialty assigned).
      if (selectedStaff?.specialtyId) {
        return room.specialtyId === selectedStaff.specialtyId;
      }
      return true;
    });
  }, [rooms, selectedUserRole, selectedStaff]);

  // Ngày làm việc: a plain <input type="date"> can't disable arbitrary
  // individual dates, so the calendar grid below fetches this staff
  // member's schedules for the displayed month and disables any day that
  // already has an overlapping-shift schedule (see OVERLAPPING_SHIFTS) —
  // recomputed whenever the staff, displayed month, or selected ca changes.
  const [displayMonth, setDisplayMonth] = useState(() => new Date());
  const monthGridRange = useMemo(() => getScheduleDatePickerGridRange(displayMonth), [displayMonth]);
  const { data: monthSchedules } = useSchedules(
    { userId, from: monthGridRange.from, to: monthGridRange.to },
    Boolean(userId),
  );
  const disabledDates = useMemo(() => {
    const overlapping = OVERLAPPING_SHIFTS[shift];
    return new Set(
      (monthSchedules ?? [])
        .filter((s) => overlapping.includes(s.shift))
        .map((s) => s.workDate.slice(0, 10)),
    );
  }, [monthSchedules, shift]);

  // Keep the selected date valid if it becomes disabled after the staff or
  // ca changes (e.g. switching from Sáng to Cả ngày on a day that already
  // has a Chiều schedule) — never leave a now-invalid date silently selected.
  useEffect(() => {
    if (workDate && disabledDates.has(workDate)) setWorkDate('');
  }, [workDate, disabledDates]);

  // Room-side conflict (a different staff member already holds this exact
  // phòng+ngày+ca) — the calendar above only knows about the selected
  // staff's own schedule, so this still needs its own check.
  const { data: sameDaySchedules } = useSchedules(
    { userId, from: workDate, to: workDate },
    Boolean(userId && workDate),
  );
  const isDuplicate = Boolean(
    roomId &&
      sameDaySchedules?.some(
        (s) => s.roomId === roomId && s.shift === shift && s.workDate.slice(0, 10) === workDate,
      ),
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    createSchedule.mutate(
      {
        userId,
        roomId,
        workDate,
        shift,
        note: note.trim() || undefined,
      },
      {
        onSuccess(result) {
          pushToast({
            title: result.message,
            description: 'Lịch làm việc đã được lưu.',
            variant: 'success',
          });
        },
        onError(error: any) {
          pushToast({
            title: 'Không thể tạo lịch làm việc',
            description: error?.message ?? 'Vui lòng thử lại.',
            variant: 'error',
          });
        },
      },
    );
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Tạo lịch làm việc"
        description="Phân công ca trực cho nhân sự."
        action={
          <Link href="/admin/schedules">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />
      <section className="space-y-4 p-5">
        <Card className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Nhân sự</span>
                <StaffPicker
                  value={userId}
                  onChange={(id) => {
                    setUserId(id);
                    setRoomId('');
                    setWorkDate('');
                  }}
                  required
                />
                {selectedStaff && (
                  <p className="text-xs text-muted-foreground">
                    Chuyên khoa: {selectedStaff.specialtyName ?? 'Chưa gán chuyên khoa (hiển thị tất cả phòng phù hợp loại)'}
                  </p>
                )}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Ngày làm việc</span>
                {userId ? (
                  <ScheduleDatePicker
                    value={workDate}
                    onChange={setWorkDate}
                    minDate={todayDateString()}
                    disabledDates={disabledDates}
                    displayMonth={displayMonth}
                    onDisplayMonthChange={setDisplayMonth}
                  />
                ) : (
                  <p className="rounded-md border border-dashed border-input p-3 text-sm text-muted-foreground">
                    Chọn nhân sự trước để xem những ngày đã có lịch.
                  </p>
                )}
                {workDate && (
                  <p className="text-xs text-muted-foreground">Đã chọn: {new Date(`${workDate}T00:00:00`).toLocaleDateString('vi-VN')}</p>
                )}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Ca làm việc</span>
                <select
                  value={shift}
                  onChange={(event) => setShift(event.target.value as ShiftType)}
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                >
                  {shiftOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Phòng</span>
                <select
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                  required
                  className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                >
                  <option value="" disabled>
                    Chọn phòng
                  </option>
                  {eligibleRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.code} - {room.name}{room.specialtyName ? ` (${room.specialtyName})` : ''}
                    </option>
                  ))}
                </select>
                {isDuplicate && (
                  <p className="text-xs text-destructive">
                    Nhân sự này đã có lịch ở phòng này, ngày này, ca này — không thể tạo trùng.
                  </p>
                )}
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Ghi chú</span>
                <textarea
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  placeholder="Ghi chú thêm (tuỳ chọn)"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createSchedule.isPending || !userId || !roomId || !workDate || isDuplicate}>
                {createSchedule.isPending ? 'Đang lưu...' : 'Lưu lịch'}
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
