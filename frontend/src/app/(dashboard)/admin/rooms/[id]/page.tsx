'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { useNotificationStore } from '@/stores/notification.store';
import { useActivateRoom, useDeactivateRoom, useRoom, useUpdateRoom } from '@/hooks/use-rooms';
import { useSpecialtyOptions } from '@/hooks/use-doctor-specialties';

const roomTypes = [
  { value: 'EXAMINATION', label: 'Phòng khám' },
  { value: 'ADMIN', label: 'Phòng hành chính' },
] as const;

export default function AdminRoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: room, isLoading, error } = useRoom(roomId);
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof roomTypes)[number]['value']>('EXAMINATION');
  const [description, setDescription] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const pushToast = useNotificationStore((state) => state.push);
  const updateRoom = useUpdateRoom();
  const activateRoom = useActivateRoom();
  const deactivateRoom = useDeactivateRoom();
  const { data: specialties = [] } = useSpecialtyOptions();

  useEffect(() => {
    if (room) {
      if (room.type === 'CLS') {
        router.replace('/admin/cls-rooms');
        return;
      }
      setName(room.name);
      setType(room.type);
      setDescription(room.description ?? '');
      setSpecialtyId(room.specialtyId ?? '');
    }
  }, [room, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomId) {
      return;
    }

    updateRoom.mutate(
      {
        id: roomId,
        input: {
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          specialtyId: specialtyId || null,
        },
      },
      {
        onSuccess() {
          pushToast({
            title: 'Cập nhật phòng thành công',
            description: 'Thông tin phòng đã được lưu.',
            variant: 'success',
          });
        },
        onError(error: any) {
          pushToast({
            title: 'Không thể cập nhật phòng',
            description: error?.message ?? 'Vui lòng thử lại.',
            variant: 'error',
          });
        },
      },
    );
  };

  const handleToggleStatus = () => {
    if (!roomId || !room) return;
    const action = room.status === 'ACTIVE' ? deactivateRoom : activateRoom;

    action.mutate(roomId, {
      onSuccess() {
        pushToast({
          title:
            room.status === 'ACTIVE'
              ? 'Đã vô hiệu hoá phòng'
              : 'Đã kích hoạt phòng',
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

  if (isLoading) {
    return <div className="p-5 text-sm text-muted-foreground">Đang tải thông tin phòng...</div>;
  }

  if (error || !room) {
    return <div className="p-5 text-sm text-destructive">Không tìm thấy phòng hoặc có lỗi xảy ra.</div>;
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={`Chi tiết phòng ${room.code}`}
        description={`Thông tin chi tiết và chỉnh sửa phòng ${room.name}.`}
        action={
          <Link href="/admin/rooms">
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
                  <p className="text-sm text-muted-foreground">Mã phòng</p>
                  <p className="text-lg font-semibold">{room.code}</p>
                </div>
                <Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>
                  {room.status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu'}
                </Badge>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Tên phòng</span>
                  <Input value={name} onChange={(event) => setName(event.target.value)} />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Loại phòng</span>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as typeof type)}
                    className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  >
                    {roomTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Chuyên khoa</span>
                  <Select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)}>
                    <option value="">Không thuộc chuyên khoa nào</option>
                    {specialties.map((specialty) => (
                      <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
                    ))}
                  </Select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Mô tả</span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={updateRoom.isPending}>
                    {updateRoom.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                  <Button
                    type="button"
                    variant={room.status === 'ACTIVE' ? 'danger' : 'secondary'}
                    onClick={handleToggleStatus}
                    disabled={activateRoom.isPending || deactivateRoom.isPending}
                  >
                    {room.status === 'ACTIVE' ? 'Vô hiệu hoá' : 'Kích hoạt'}
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
                  {room.description || 'Chưa có mô tả cho phòng này.'}
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg bg-muted p-4">
                  <p className="font-medium text-foreground">Loại phòng</p>
                  <p>{roomTypes.find((item) => item.value === room.type)?.label ?? room.type}</p>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <p className="font-medium text-foreground">Chuyên khoa</p>
                  <p>{room.specialtyName ?? 'Chưa gán chuyên khoa'}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
