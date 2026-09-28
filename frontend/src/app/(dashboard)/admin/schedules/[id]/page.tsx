'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/shared/page-header';
import { useNotificationStore } from '@/stores/notification.store';
import { useDeleteSchedule, useSchedule, useUpdateSchedule } from '@/hooks/use-schedules';
import { useRooms } from '@/hooks/use-rooms';
import type { ShiftType } from '@/types/schedules';

const shiftOptions: { value: ShiftType; label: string }[] = [
  { value: 'MORNING', label: 'Sáng' },
  { value: 'AFTERNOON', label: 'Chiều' },
  { value: 'FULL_DAY', label: 'Cả ngày' },
];

const roleLabels: Record<string, string> = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  NURSE: 'Điều dưỡng',
  LAB_TECH: 'Kỹ thuật viên',
  PATIENT: 'Bệnh nhân',
};

function toDateInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatAppointmentTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminScheduleDetailPage() {
  const params = useParams();
  const scheduleId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: schedule, isLoading, error } = useSchedule(scheduleId);
  const [roomId, setRoomId] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [shift, setShift] = useState<ShiftType>('MORNING');
  const [note, setNote] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmEditOpen, setConfirmEditOpen] = useState(false);
  const pushToast = useNotificationStore((state) => state.push);
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const { data: rooms } = useRooms();

  useEffect(() => {
    if (schedule) {
      setRoomId(schedule.roomId);
      setWorkDate(toDateInput(schedule.workDate));
      setShift(schedule.shift);
      setNote(schedule.note ?? '');
    }
  }, [schedule]);

  const eligibleRooms = useMemo(() => {
    const role = schedule?.userRole;
    let requiredType: 'CLS' | 'ADMIN' | 'EXAMINATION' = 'EXAMINATION';
    if (role === 'LAB_TECH') requiredType = 'CLS';
    else if (role === 'RECEPTIONIST' || role === 'ADMIN') requiredType = 'ADMIN';
    return (rooms ?? []).filter((room) => room.status === 'ACTIVE' && room.type === requiredType);
  }, [rooms, schedule?.userRole]);

  const submitUpdate = () => {
    if (!scheduleId) return;

    updateSchedule.mutate(
      {
        id: scheduleId,
        input: { roomId, workDate, shift, note: note.trim() || undefined },
      },
      {
        onSuccess(result) {
          setConfirmEditOpen(false);
          pushToast({
            title: result.message,
            description: 'Lịch làm việc đã được cập nhật.',
            variant: 'success',
          });
        },
        onError(error: any) {
          setConfirmEditOpen(false);
          pushToast({
            title: 'Không thể cập nhật lịch làm việc',
            description: error?.message ?? 'Vui lòng thử lại.',
            variant: 'error',
          });
        },
      },
    );
  };

  // Đổi phòng/ngày/ca không tự đồng bộ sang các lịch hẹn đã đặt (appointment
  // lưu snapshot riêng room_id/appointment_time) — nếu có lịch hẹn liên kết
  // và 1 trong 3 trường này thực sự đổi, chặn lại để admin thấy rõ cần báo
  // lễ tân gọi điện cho ai trước khi lưu.
  const affectsExistingAppointments =
    !!schedule &&
    (schedule.linkedAppointments?.length ?? 0) > 0 &&
    (roomId !== schedule.roomId || workDate !== toDateInput(schedule.workDate) || shift !== schedule.shift);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleId) {
      return;
    }

    if (affectsExistingAppointments) {
      setConfirmEditOpen(true);
      return;
    }

    submitUpdate();
  };

  const handleDelete = () => {
    if (!scheduleId) return;

    deleteSchedule.mutate(scheduleId, {
      onSuccess(result) {
        pushToast({
          title: result.message,
          description: 'Lịch làm việc đã được xoá.',
          variant: 'success',
        });
      },
      onError(error: any) {
        setConfirmDeleteOpen(false);
        pushToast({
          title: 'Không thể xoá lịch làm việc',
          description: error?.message ?? 'Vui lòng thử lại.',
          variant: 'error',
        });
      },
    });
  };

  if (isLoading) {
    return <div className="p-5 text-sm text-muted-foreground">Đang tải thông tin lịch làm việc...</div>;
  }

  if (error || !schedule) {
    return <div className="p-5 text-sm text-destructive">Không tìm thấy lịch làm việc hoặc có lỗi xảy ra.</div>;
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={`Chi tiết lịch làm việc - ${schedule.userName}`}
        description={`Ca trực ngày ${toDateInput(schedule.workDate)}.`}
        action={
          <Link href="/admin/schedules">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nhân sự</p>
                  <p className="text-lg font-semibold">{schedule.userName}</p>
                </div>
                <Badge variant="muted">{roleLabels[schedule.userRole] ?? schedule.userRole}</Badge>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Phòng</span>
                  <select
                    value={roomId}
                    onChange={(event) => setRoomId(event.target.value)}
                    required
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  >
                    {eligibleRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.code} - {room.name}
                      </option>
                    ))}
                    {!eligibleRooms.some((room) => room.id === schedule.roomId) && (
                      <option value={schedule.roomId}>
                        {schedule.roomCode} - {schedule.roomName}
                      </option>
                    )}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Ngày làm việc</span>
                  <input
                    type="date"
                    value={workDate}
                    onChange={(event) => setWorkDate(event.target.value)}
                    required
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
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
                  <span className="text-sm font-medium text-foreground">Ghi chú</span>
                  <textarea
                    rows={4}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateSchedule.isPending}>
                    {updateSchedule.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                  <Button type="button" variant="danger" onClick={() => setConfirmDeleteOpen(true)}>
                    Xóa lịch
                  </Button>
                </div>
              </form>
            </div>
          </Card>

          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Thông tin thêm</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {schedule.note || 'Chưa có ghi chú cho lịch làm việc này.'}
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg bg-muted p-4">
                  <p className="font-medium text-foreground">Vai trò</p>
                  <p>{roleLabels[schedule.userRole] ?? schedule.userRole}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="font-medium text-foreground">Phòng hiện tại</p>
                  <p>{schedule.roomCode} - {schedule.roomName}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <Dialog
        open={confirmEditOpen}
        onClose={() => setConfirmEditOpen(false)}
        title="Xác nhận thay đổi lịch làm việc"
        description="Thay đổi này không tự cập nhật lịch hẹn của bệnh nhân — lễ tân cần chủ động gọi điện thông báo cho những người dưới đây."
      >
        <div className="space-y-4">
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-3">
            {schedule?.linkedAppointments?.map((appt) => (
              <li key={appt.id} className="text-sm text-amber-800">
                <span className="font-medium">{appt.patientName}</span> — {appt.patientPhone} — giờ hẹn cũ:{' '}
                {formatAppointmentTime(appt.appointmentTime)}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmEditOpen(false)} disabled={updateSchedule.isPending}>
              Hủy
            </Button>
            <Button onClick={submitUpdate} disabled={updateSchedule.isPending}>
              {updateSchedule.isPending ? 'Đang lưu...' : 'Vẫn lưu thay đổi'}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Xóa lịch làm việc"
        description="Bạn có chắc chắn muốn xóa lịch làm việc này không?"
      >
        <div className="space-y-4">
          {schedule.hasLinkedAppointments && (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Lịch làm việc này đang có lịch hẹn liên kết. Việc xóa có thể bị từ chối hoặc ảnh hưởng đến các lịch hẹn liên quan.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)} disabled={deleteSchedule.isPending}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleteSchedule.isPending}>
              {deleteSchedule.isPending ? 'Đang xoá...' : 'Xác nhận xoá'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
