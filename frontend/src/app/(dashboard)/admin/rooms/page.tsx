'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Plus, Eye, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { useActivateRoom, useDeactivateRoom, useRooms } from '@/hooks/use-rooms';
import { useNotificationStore } from '@/stores/notification.store';

const roomTypes = {
  EXAMINATION: 'Phòng khám',
  CLS: 'Phòng cận lâm sàng',
  ADMIN: 'Phòng hành chính',
} as const;

export default function AdminRoomsPage() {
  const [search, setSearch] = useState('');
  const { data: rooms, isLoading, error } = useRooms();
  const activateRoom = useActivateRoom();
  const deactivateRoom = useDeactivateRoom();
  const pushToast = useNotificationStore((state) => state.push);

  const filteredRooms = useMemo(
    () =>
      rooms?.filter((room) => {
        if (room.type === 'CLS') return false;
        const keyword = search.trim().toLowerCase();
        if (!keyword) return true;
        return (
          room.code.toLowerCase().includes(keyword) ||
          room.name.toLowerCase().includes(keyword) ||
          room.type.toLowerCase().includes(keyword) ||
          room.status.toLowerCase().includes(keyword)
        );
      }) ?? [],
    [rooms, search],
  );

  const handleToggleStatus = (roomId: string, active: boolean) => {
    const action = active ? deactivateRoom : activateRoom;

    action.mutate(roomId, {
      onSuccess() {
        pushToast({
          title: active ? 'Đã vô hiệu hoá phòng' : 'Đã kích hoạt phòng',
          description: 'Trạng thái phòng đã được cập nhật.',
          variant: 'success',
        });
      },
      onError(error: any) {
        pushToast({
          title: 'Không thể cập nhật trạng thái',
          description: error?.message ?? 'Vui lòng thử lại.',
          variant: 'error',
        });
      },
    });
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Quản lý phòng"
        description="Danh sách phòng khám, phòng điều trị và phòng hành chính."
        action={
          <Link href="/admin/rooms/new">
            <Button>
              <Plus className="h-4 w-4" />
              Tạo phòng
            </Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm" />
          </div>
          <Badge variant="muted">{filteredRooms.length} bản ghi</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Mã phòng</th>
                  <th className="h-10 px-4 font-semibold">Tên phòng</th>
                  <th className="h-10 px-4 font-semibold">Loại</th>
                  <th className="h-10 px-4 font-semibold">Chuyên khoa</th>
                  <th className="h-10 px-4 font-semibold">Trạng thái</th>
                  <th className="h-10 px-4 font-semibold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="h-20 px-4 text-center text-muted-foreground">
                      Đang tải danh sách phòng...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="h-20 px-4 text-center text-destructive">
                      Không thể tải dữ liệu phòng.
                    </td>
                  </tr>
                ) : filteredRooms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="h-20 px-4 text-center text-muted-foreground">
                      Không tìm thấy phòng phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredRooms.map((room) => (
                    <tr key={room.id} className="border-t border-border bg-white hover:bg-muted/50">
                      <td className="h-12 px-4">{room.code}</td>
                      <td className="h-12 px-4">{room.name}</td>
                      <td className="h-12 px-4">{roomTypes[room.type] ?? room.type}</td>
                      <td className="h-12 px-4 text-muted-foreground">{room.specialtyName ?? '—'}</td>
                      <td className="h-12 px-4">
                        <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                          {room.status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu'}
                        </Badge>
                      </td>
                      <td className="h-12 px-4">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/rooms/${room.id}`} className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted/80">
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            Chi tiết
                          </Link>
                          {room.status === 'ACTIVE' ? (
                            <Button size="sm" variant="danger" onClick={() => handleToggleStatus(room.id, true)}>
                              <XCircle className="h-4 w-4" />
                              Vô hiệu
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => handleToggleStatus(room.id, false)}>
                              <CheckCircle2 className="h-4 w-4" />
                              Kích hoạt
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
