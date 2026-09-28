'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExpandableTextInput } from '@/components/shared/expandable-text-input';
import { PageHeader } from '@/components/shared/page-header';
import { StaffPicker } from '@/components/shared/staff-picker';
import { useCreateBulkSchedule, useSchedules } from '@/hooks/use-schedules';
import { useRooms } from '@/hooks/use-rooms';
import { useStaffOptions } from '@/hooks/use-staff-options';
import { todayDateString } from '@/lib/utils/date';
import type { BulkScheduleResult, ShiftType } from '@/types/schedules';

const shiftOptions: { value: ShiftType; label: string }[] = [
  { value: 'MORNING', label: 'Sáng' },
  { value: 'AFTERNOON', label: 'Chiều' },
  { value: 'FULL_DAY', label: 'Cả ngày' },
];

const weekdayOptions = [
  { value: 1, label: 'Thứ 2' },
  { value: 2, label: 'Thứ 3' },
  { value: 3, label: 'Thứ 4' },
  { value: 4, label: 'Thứ 5' },
  { value: 5, label: 'Thứ 6' },
  { value: 6, label: 'Thứ 7' },
  { value: 0, label: 'Chủ nhật' },
];

const skipReasonLabels: Record<string, string> = {
  MSG_ERR_0031: 'Nhân viên đã có ca khác cùng ngày/ca',
  MSG_ERR_0058: 'Phòng đã được gán cho nhân viên khác',
  MSG_ERR_0006: 'Ngày không hợp lệ hoặc phòng không hoạt động',
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

// Mirrors CreateBulkScheduleUseCase's own date-range × daysOfWeek expansion
// (same MAX_RANGE_DAYS cap, same Date.UTC arithmetic) — purely a client-side
// preview, the actual list of dates to create is still decided server-side.
const MAX_RANGE_DAYS = 62;

function buildTargetDates(fromDate: string, toDate: string, daysOfWeek: number[]): string[] {
  if (!fromDate || !toDate) return [];
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return [];

  const days = new Set(daysOfWeek);
  const dates: string[] = [];
  let cursor = from;
  let iterations = 0;
  while (cursor <= to && iterations < MAX_RANGE_DAYS) {
    iterations += 1;
    if (days.has(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

function formatDateWithWeekday(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const weekday = weekdayOptions.find((w) => w.value === date.getUTCDay())?.label ?? '';
  return `${weekday} (${date.toLocaleDateString('vi-VN', { timeZone: 'UTC' })})`;
}

// Feature 39 (bổ sung 2026-07-09): tạo lịch lặp lại theo tuần trong 1 lần
// submit — best-effort, ngày nào bị trùng ca/quá khứ thì bị bỏ qua
// và liệt kê lý do, các ngày còn lại vẫn được tạo bình thường.
export default function AdminSchedulesBulkPage() {
  const [userId, setUserId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [shift, setShift] = useState<ShiftType>('MORNING');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [note, setNote] = useState('');
  const [result, setResult] = useState<BulkScheduleResult | null>(null);

  const { data: rooms } = useRooms();
  const createBulk = useCreateBulkSchedule();
  const staffOptions = useStaffOptions();

  const selectedStaff = useMemo(
    () => staffOptions.find((u) => u.id === userId) ?? null,
    [staffOptions, userId],
  );
  const selectedUserRole = selectedStaff?.role ?? null;

  // Kept in sync with admin/schedules/new/page.tsx's eligibleRooms — this
  // bulk-create form was missing the specialty narrowing entirely (only
  // filtered by role→room-type), so e.g. a Tim mạch doctor would see every
  // Phòng khám room including Nội tổng quát/Nhi/... instead of just their
  // own specialty's rooms.
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
      if (selectedStaff?.specialtyId) {
        return room.specialtyId === selectedStaff.specialtyId;
      }
      return true;
    });
  }, [rooms, selectedUserRole, selectedStaff]);

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // Preview (đề xuất đã được duyệt): trước khi bấm "Tạo lịch hàng loạt",
  // liệt kê ngay ngày nào trong khoảng đã có lịch cho đúng nhân sự + phòng +
  // ca này — thay vì để admin bấm tạo rồi mới biết qua danh sách "bỏ qua"
  // phía dưới. Chỉ đọc lịch hiện có của nhân sự đang chọn (GET /schedules
  // có sẵn, không cần thêm API) rồi lọc theo phòng+ca ở client — việc tạo
  // thật vẫn để CreateBulkScheduleUseCase tự quyết định/bỏ qua như cũ.
  const targetDates = useMemo(
    () => buildTargetDates(fromDate, toDate, daysOfWeek),
    [fromDate, toDate, daysOfWeek],
  );
  const showPreview = Boolean(userId && roomId && fromDate && toDate && targetDates.length > 0);
  const { data: existingSchedules } = useSchedules({ userId, from: fromDate, to: toDate }, showPreview);

  const alreadyScheduledDates = useMemo(() => {
    return new Set(
      (existingSchedules ?? [])
        .filter((s) => s.roomId === roomId && s.shift === shift)
        .map((s) => s.workDate.slice(0, 10)),
    );
  }, [existingSchedules, roomId, shift]);

  const previewRows = useMemo(
    () => targetDates.map((date) => ({ date, alreadyScheduled: alreadyScheduledDates.has(date) })),
    [targetDates, alreadyScheduledDates],
  );
  const previewNewCount = previewRows.filter((r) => !r.alreadyScheduled).length;
  const previewDupCount = previewRows.length - previewNewCount;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || !roomId || !fromDate || !toDate || daysOfWeek.length === 0) return;

    createBulk.mutate(
      { userId, roomId, shift, fromDate, toDate, daysOfWeek, note: note.trim() || undefined },
      { onSuccess: (res) => setResult(res.data) },
    );
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Tạo lịch làm việc hàng loạt"
        description="Lặp lại 1 ca cho 1 nhân sự theo các thứ trong tuần, trong 1 khoảng ngày — thay vì tạo từng ngày một."
        action={
          <Link href="/admin/schedules">
            <Button variant="secondary">Trở về danh sách lịch</Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <Card className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Nhân sự</span>
                <StaffPicker
                  value={userId}
                  onChange={(id) => {
                    setUserId(id);
                    setRoomId('');
                  }}
                  required
                />
                {selectedStaff && (
                  <p className="text-xs text-muted-foreground">
                    Chuyên khoa: {selectedStaff.specialtyName ?? 'Chưa gán chuyên khoa (hiển thị tất cả phòng phù hợp loại)'}
                  </p>
                )}
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
              <div />
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Từ ngày</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  min={todayDateString()}
                  required
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Đến ngày</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  min={fromDate || todayDateString()}
                  required
                />
              </label>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Lặp lại vào các thứ</span>
              <div className="flex flex-wrap gap-2">
                {weekdayOptions.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    className={`h-9 rounded-md border px-3 text-sm font-medium transition-colors ${
                      daysOfWeek.includes(day.value)
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-white text-muted-foreground hover:border-primary'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {showPreview && (
              <div className="space-y-2 rounded-md border border-border p-3">
                <p className="text-sm font-medium text-foreground">
                  Xem trước: sẽ tạo {previewNewCount} ca
                  {previewDupCount > 0 ? ` — ${previewDupCount} ngày đã có lịch, sẽ tự động bỏ qua` : ''}
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                  {previewRows.map((row) => (
                    <li
                      key={row.date}
                      className={`flex items-center gap-2 ${row.alreadyScheduled ? 'text-muted-foreground' : 'text-foreground'}`}
                    >
                      <input
                        type="checkbox"
                        checked={!row.alreadyScheduled}
                        disabled={row.alreadyScheduled}
                        readOnly
                        className="h-4 w-4 shrink-0"
                        aria-label={row.alreadyScheduled ? 'Ngày đã có lịch, không thể tạo lại' : 'Sẽ tạo lịch cho ngày này'}
                      />
                      <span className={row.alreadyScheduled ? 'line-through' : ''}>
                        {formatDateWithWeekday(row.date)}
                      </span>
                      {row.alreadyScheduled && <span className="text-xs">— đã có lịch</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <ExpandableTextInput
                label="Ghi chú"
                value={note}
                onChange={setNote}
                placeholder="Ghi chú thêm (tuỳ chọn)"
              />
            </div>

            <Button type="submit" disabled={createBulk.isPending || daysOfWeek.length === 0}>
              {createBulk.isPending ? 'Đang tạo...' : 'Tạo lịch hàng loạt'}
            </Button>
          </form>
        </Card>

        {result && (
          <Card className="p-6">
            <p className="text-sm font-semibold text-foreground">
              Đã tạo {result.created.length} ca — bỏ qua {result.skipped.length} ngày.
            </p>
            {result.skipped.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {result.skipped.map((skip) => (
                  <li key={skip.date}>
                    <span className="font-medium text-foreground">{formatDate(skip.date)}</span>
                    {' — '}
                    {skipReasonLabels[skip.reason] ?? skip.reason}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </section>
    </div>
  );
}
