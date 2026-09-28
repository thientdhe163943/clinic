'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRooms } from '@/hooks/use-rooms';
import { useSchedules } from '@/hooks/use-schedules';
import { useVisits } from '@/hooks/use-visits';
import type { VisitPriority } from '@/types/appointments';
import type { Schedule } from '@/types/schedules';
import type { VisitListItem } from '@/types/visits';

// Local (not UTC) today — same pad-based helper used across the other
// receptionist/nurse pages (toISOString() would roll back a day in UTC+7
// during 00:00-06:59 local time).
function todayDateInput() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function matchesSearch(visit: VisitListItem, term: string): boolean {
  if (!term) return true;
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return (
    visit.patientName.toLowerCase().includes(q) ||
    visit.patientCode.toLowerCase().includes(q) ||
    visit.patientPhone.toLowerCase().includes(q)
  );
}

const priorityLabel: Record<VisitPriority, string> = {
  NORMAL: 'Thường',
  ELDERLY: 'Người cao tuổi',
  PREGNANT: 'Phụ nữ mang thai',
  CHILD: 'Trẻ em',
  EMERGENCY: 'Cấp cứu',
};

const SHIFT_LABEL: Record<Schedule['shift'], string> = {
  MORNING: 'Ca sáng',
  AFTERNOON: 'Ca chiều',
  FULL_DAY: 'Cả ngày',
};

// Sáng → Chiều → Cả ngày, để phòng có nhiều ca luôn hiện cùng thứ tự.
const SHIFT_ORDER: Record<Schedule['shift'], number> = { MORNING: 0, AFTERNOON: 1, FULL_DAY: 2 };

type RoomStatusFilter = '' | 'OCCUPIED' | 'EMPTY';

const ROOM_STATUS_FILTERS: { value: RoomStatusFilter; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'OCCUPIED', label: 'Đang khám' },
  { value: 'EMPTY', label: 'Trống' },
];

// Only the first couple of waiting patients show by default — "Xem tất cả"
// expands the rest, same collapsed-preview pattern as the images this tab
// was designed from.
const WAITING_PREVIEW_COUNT = 2;

// Read-only reception board: which examination rooms are occupied right now
// and who's still waiting — version-up 0.2 item #4 ("reception overview
// board"). RECEPTIONIST is allowed on both GET /rooms and GET /visits (see
// visits.controller.ts), so no new backend endpoint is needed here.
export function ReceptionClinicBoard({ tabsElement }: { tabsElement: ReactNode }) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(todayDateInput);
  const [roomStatus, setRoomStatus] = useState<RoomStatusFilter>('');
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const { data: rooms = [], isLoading: roomsLoading } = useRooms();
  const { data: visits = [], isLoading: visitsLoading } = useVisits({ date });
  // Bác sĩ được xếp lịch trực theo phòng cho đúng ngày đang xem — để một
  // phòng trống vẫn cho lễ tân biết "phòng này đã có bác sĩ". RECEPTIONIST
  // được phép GET /schedules (list-schedules.use-case.ts — ngoại lệ #4).
  const { data: doctorSchedules = [] } = useSchedules({ role: 'DOCTOR', from: date, to: date });

  const examRooms = useMemo(
    () => rooms.filter((room) => room.type === 'EXAMINATION' && room.status === 'ACTIVE'),
    [rooms],
  );

  const inProgressByRoomId = useMemo(() => {
    const map = new Map<string, VisitListItem>();
    for (const visit of visits) {
      if (visit.status === 'IN_PROGRESS') map.set(visit.roomId, visit);
    }
    return map;
  }, [visits]);

  // roomId → các ca bác sĩ trực phòng đó trong ngày (có thể vừa ca sáng vừa
  // ca chiều là 2 người khác nhau).
  const doctorsByRoomId = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    for (const schedule of doctorSchedules) {
      const list = map.get(schedule.roomId) ?? [];
      list.push(schedule);
      map.set(schedule.roomId, list);
    }
    for (const list of map.values()) list.sort((a, b) => SHIFT_ORDER[a.shift] - SHIFT_ORDER[b.shift]);
    return map;
  }, [doctorSchedules]);

  // Tìm theo tên/mã/SĐT chỉ áp dụng cho bệnh nhân đang chờ hoặc đang được
  // khám — một phòng "trống" hay một lượt khám đã hoàn tất/vắng mặt không có
  // ý nghĩa để tìm ở màn này.
  const visibleRooms = useMemo(
    () =>
      examRooms.filter((room) => {
        const visit = inProgressByRoomId.get(room.id);
        if (roomStatus === 'OCCUPIED' && !visit) return false;
        if (roomStatus === 'EMPTY' && visit) return false;
        if (search && !(visit && matchesSearch(visit, search))) return false;
        return true;
      }),
    [examRooms, inProgressByRoomId, roomStatus, search],
  );

  const waiting = useMemo(
    () =>
      visits
        .filter((v) => v.status === 'WAITING' && matchesSearch(v, search))
        .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber)),
    [visits, search],
  );

  const visibleWaiting = showAllWaiting ? waiting : waiting.slice(0, WAITING_PREVIEW_COUNT);
  const isLoading = roomsLoading || visitsLoading;
  const selectedRoom = examRooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedVisit = selectedRoomId ? inProgressByRoomId.get(selectedRoomId) ?? null : null;
  const selectedRoomDoctors = selectedRoomId ? doctorsByRoomId.get(selectedRoomId) ?? [] : [];

  // Hàng chờ riêng của phòng đang xem chi tiết — cùng nguồn `visits` với bảng
  // "Đang chờ khám" tổng, chỉ lọc thêm theo roomId (mỗi visit đã gắn phòng
  // ngay từ lúc tạo, kể cả khi còn ở trạng thái WAITING).
  const roomWaitingQueue = useMemo(
    () =>
      visits
        .filter((v) => v.status === 'WAITING' && v.roomId === selectedRoomId)
        .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber)),
    [visits, selectedRoomId],
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
            <form
              className="flex w-full gap-2 md:max-w-sm"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput.trim());
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Tìm theo tên/mã/SĐT bệnh nhân"
                />
              </div>
              <Button type="submit" variant="secondary">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
              <select
                value={roomStatus}
                onChange={(e) => setRoomStatus(e.target.value as RoomStatusFilter)}
                className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              >
                {ROOM_STATUS_FILTERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {(date !== todayDateInput() || roomStatus) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDate(todayDateInput());
                    setRoomStatus('');
                  }}
                >
                  <X className="h-4 w-4" />
                  Xóa lọc
                </Button>
              )}
            </div>
          </div>

          {tabsElement}
        </div>

        <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">Đang tải phòng khám...</p>
          ) : examRooms.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Chưa có phòng khám nào đang hoạt động
            </p>
          ) : visibleRooms.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
              Không tìm thấy phòng khám phù hợp
            </p>
          ) : (
            visibleRooms.map((room) => {
              const visit = inProgressByRoomId.get(room.id);
              const roomDoctors = doctorsByRoomId.get(room.id) ?? [];
              return (
                <Card
                  key={room.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRoomId(room.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedRoomId(room.id);
                  }}
                  className="cursor-pointer p-4 transition-colors hover:border-primary/40 hover:bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{room.name}</p>
                      <p className="text-xs text-muted-foreground">{visit ? visit.serviceName : 'Trống'}</p>
                    </div>
                    <Badge variant={visit ? 'success' : 'muted'}>{visit ? 'Đang khám' : 'Trống - Sẵn sàng'}</Badge>
                  </div>
                  {visit ? (
                    <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                      <p className="font-medium text-foreground">BS. {visit.doctorName}</p>
                      <p className="text-muted-foreground">{visit.patientName}</p>
                      <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                        <span>Bắt đầu: {formatTime(visit.startedAt)}</span>
                        <span className="font-semibold text-primary">#{visit.queueNumber}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                      {roomDoctors.length === 0 ? (
                        <p className="text-muted-foreground">Chưa xếp bác sĩ trực phòng này</p>
                      ) : (
                        roomDoctors.map((schedule) => (
                          <div key={schedule.id} className="flex items-center justify-between gap-2">
                            <span
                              className={
                                schedule.isAbsent
                                  ? 'font-medium text-muted-foreground line-through'
                                  : 'font-medium text-foreground'
                              }
                            >
                              BS. {schedule.userName}
                            </span>
                            <span className="text-xs text-muted-foreground">{SHIFT_LABEL[schedule.shift]}</span>
                          </div>
                        ))
                      )}
                      {roomDoctors.some((schedule) => schedule.isAbsent) && (
                        <p className="text-xs text-amber-600">Có ca bác sĩ báo vắng</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="text-sm font-semibold text-foreground">Đang chờ khám ({waiting.length} bệnh nhân)</p>
          {waiting.length > WAITING_PREVIEW_COUNT && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setShowAllWaiting((v) => !v)}
            >
              {showAllWaiting ? 'Thu gọn' : 'Xem tất cả'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="h-10 px-4 font-semibold">STT</th>
                <th className="h-10 px-4 font-semibold">Bệnh nhân</th>
                <th className="h-10 px-4 font-semibold">Bác sĩ phụ trách</th>
                <th className="h-10 px-4 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && waiting.length === 0 ? (
                <tr>
                  <td colSpan={4} className="h-16 px-4 text-center text-muted-foreground">
                    Không có bệnh nhân đang chờ
                  </td>
                </tr>
              ) : (
                visibleWaiting.map((visit) => (
                  <tr key={visit.id} className="border-t border-border">
                    <td className="h-12 px-4 font-semibold text-primary">#{visit.queueNumber}</td>
                    <td className="h-12 px-4 font-medium text-foreground">{visit.patientName}</td>
                    <td className="h-12 px-4 text-muted-foreground">BS. {visit.doctorName}</td>
                    <td className="h-12 px-4">
                      <Badge variant="warning">Đang chờ</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!showAllWaiting && waiting.length > WAITING_PREVIEW_COUNT && (
          <p className="border-t border-border p-3 text-center text-xs italic text-muted-foreground">
            Hiển thị {visibleWaiting.length} trong số {waiting.length} bệnh nhân đang chờ.
          </p>
        )}
      </Card>

      <Dialog
        open={Boolean(selectedRoomId)}
        onClose={() => setSelectedRoomId(null)}
        title={selectedRoom?.name ?? 'Chi tiết phòng'}
        className="max-w-lg"
      >
        <div className="space-y-4">
          {selectedVisit ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <Badge variant="success">Đang khám</Badge>
                <span className="font-semibold text-primary">#{selectedVisit.queueNumber}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                <div className="col-span-2">
                  <p className="text-muted-foreground">Bệnh nhân</p>
                  <p className="font-medium text-foreground">{selectedVisit.patientName}</p>
                  <p className="text-xs text-muted-foreground">{selectedVisit.patientCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bác sĩ phụ trách</p>
                  <p className="font-medium text-foreground">BS. {selectedVisit.doctorName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dịch vụ</p>
                  <p className="font-medium text-foreground">{selectedVisit.serviceName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Giờ bắt đầu khám</p>
                  <p className="font-medium text-foreground">{formatTime(selectedVisit.startedAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mức ưu tiên</p>
                  <p className="font-medium text-foreground">{priorityLabel[selectedVisit.priority]}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Phòng đang trống, sẵn sàng tiếp nhận bệnh nhân tiếp theo.</p>
              <div className="border-t border-border pt-2">
                <p className="mb-1 font-semibold text-foreground">Bác sĩ trực phòng</p>
                {selectedRoomDoctors.length === 0 ? (
                  <p className="text-muted-foreground">Chưa xếp bác sĩ cho phòng này trong ngày.</p>
                ) : (
                  <ul className="space-y-1">
                    {selectedRoomDoctors.map((schedule) => (
                      <li key={schedule.id} className="flex items-center justify-between gap-2">
                        <span className={schedule.isAbsent ? 'text-muted-foreground line-through' : 'text-foreground'}>
                          BS. {schedule.userName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {SHIFT_LABEL[schedule.shift]}
                          {schedule.isAbsent ? ' · báo vắng' : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <p className="mb-2 text-sm font-semibold text-foreground">
              Hàng chờ khám tại phòng ({roomWaitingQueue.length})
            </p>
            {roomWaitingQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có bệnh nhân đang chờ tại phòng này.</p>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {roomWaitingQueue.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">#{visit.queueNumber}</span>
                      <div>
                        <p className="font-medium text-foreground">{visit.patientName}</p>
                        <p className="text-xs text-muted-foreground">{visit.patientCode}</p>
                      </div>
                    </div>
                    {visit.priority !== 'NORMAL' && <Badge variant="warning">{priorityLabel[visit.priority]}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
}
