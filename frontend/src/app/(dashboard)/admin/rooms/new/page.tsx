'use client';

import { useState } from 'react';
import { useNotificationStore } from '@/stores/notification.store';
import { useCreateRoom } from '@/hooks/use-rooms';
import { useSpecialtyOptions } from '@/hooks/use-doctor-specialties';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import Link from 'next/link';

const roomTypes = [
  { value: 'EXAMINATION', label: 'Phòng khám' },
  { value: 'ADMIN', label: 'Phòng hành chính' },
] as const;

export default function AdminRoomsCreatePage() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof roomTypes)[number]['value']>('EXAMINATION');
  const [description, setDescription] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const pushToast = useNotificationStore((state) => state.push);
  const createRoom = useCreateRoom();
  const { data: specialties = [] } = useSpecialtyOptions();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    createRoom.mutate(
      {
        code: code.trim(),
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        specialtyId: specialtyId || undefined,
      },
      {
        onSuccess() {
          pushToast({
            title: 'Tạo phòng thành công',
            description: 'Phòng đã được lưu và hiển thị trong danh sách.',
            variant: 'success',
          });
        },
        onError(error: any) {
          pushToast({
            title: 'Không thể tạo phòng',
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
        title="Tạo phòng mới"
        description="Tạo phòng khám, phòng điều trị hoặc phòng hành chính mới."
        action={
          <Link href="/admin/rooms">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />
      <section className="space-y-4 p-5">
        <Card className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Mã phòng</span>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="VD: PK-01"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">Tên phòng</span>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="VD: Phòng khám Nội 1"
                />
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
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">Mô tả</span>
                <textarea
                  rows={5}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                  placeholder="Ghi chú thêm về phòng (tuỳ chọn)"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createRoom.isPending}>
                {createRoom.isPending ? 'Đang lưu...' : 'Lưu phòng'}
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
