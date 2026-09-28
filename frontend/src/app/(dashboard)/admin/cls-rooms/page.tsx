'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, Pencil, Plus, Search, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/shared/page-header';
import { useClsRoomMutations, useClsRooms } from '@/hooks/use-cls-rooms';
import { useSpecialtyOptions } from '@/hooks/use-doctor-specialties';
import { useNotificationStore } from '@/stores/notification.store';
import type { ClsRoomCategory, Room, RoomStatus, SaveClsRoomRequest } from '@/types/rooms';

const clsCategoryLabel: Record<ClsRoomCategory, string> = {
  LAB: 'Xét nghiệm',
  XRAY: 'X-quang',
  ULTRASOUND: 'Siêu âm',
  ECG: 'Chụp điện tim',
};

// Form-only state widens clsCategory to allow '' (nothing picked yet) —
// SaveClsRoomRequest itself keeps clsCategory required for the actual API call.
type ClsRoomFormState = Omit<SaveClsRoomRequest, 'clsCategory' | 'specialtyId'> & {
  clsCategory: ClsRoomCategory | '';
  specialtyId: string;
};
const emptyForm: ClsRoomFormState = { name: '', techniqueType: '', clsCategory: '', description: '', specialtyId: '' };

export default function ClsRoomsPage() {
  const [status, setStatus] = useState<RoomStatus | undefined>();
  const [category, setCategory] = useState<ClsRoomCategory | undefined>();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Room | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ClsRoomFormState>(emptyForm);
  const [confirmRoom, setConfirmRoom] = useState<Room | null>(null);
  const [unfinishedOrders, setUnfinishedOrders] = useState(0);
  const { data = [], isLoading, error } = useClsRooms(status, category);
  const actions = useClsRoomMutations();
  const push = useNotificationStore((state) => state.push);
  const { data: specialties = [] } = useSpecialtyOptions();

  const rooms = useMemo(() => data.filter((room) => {
    const q = search.trim().toLowerCase();
    return !q || [room.code, room.name, room.techniqueType ?? ''].some((value) => value.toLowerCase().includes(q));
  }), [data, search]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (room: Room) => {
    setEditing(room);
    setForm({
      name: room.name,
      techniqueType: room.techniqueType ?? '',
      clsCategory: room.clsCategory ?? '',
      description: room.description ?? '',
      specialtyId: room.specialtyId ?? '',
    });
    setFormOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.clsCategory) {
      push({ title: 'Vui lòng chọn chuyên môn phòng CLS', variant: 'warning' });
      return;
    }
    const input: SaveClsRoomRequest = { ...form, clsCategory: form.clsCategory, specialtyId: form.specialtyId || null };
    const mutation = editing ? actions.update : actions.create;
    const variables = editing ? { id: editing.id, input } : input;
    mutation.mutate(variables as never, {
      onSuccess: () => { setFormOpen(false); push({ title: editing ? 'Đã cập nhật phòng CLS' : 'Đã tạo phòng CLS', variant: 'success' }); },
      onError: (e: any) => push({ title: 'Không thể lưu phòng CLS', description: e?.message, variant: 'error' }),
    });
  };

  const deactivate = (room: Room, confirm = false) => {
    actions.deactivate.mutate({ id: room.id, confirm }, {
      onSuccess: (result) => {
        if (result.data?.requiresConfirmation) {
          setUnfinishedOrders(result.data.unfinishedOrders);
          setConfirmRoom(room);
          return;
        }
        setConfirmRoom(null);
        push({ title: 'Đã vô hiệu hóa phòng CLS', variant: 'success' });
      },
      onError: (e: any) => push({ title: 'Không thể vô hiệu hóa', description: e?.message, variant: 'error' }),
    });
  };

  return <div className="min-h-full bg-background">
    <PageHeader title="Quản lý phòng CLS" description="Phòng xét nghiệm, chẩn đoán hình ảnh và kỹ thuật cận lâm sàng." action={<Button onClick={openCreate}><Plus className="h-4 w-4" />Tạo phòng CLS</Button>} />
    <section className="space-y-4 p-5">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo mã, tên hoặc kỹ thuật" /></div>
        <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={status ?? ''} onChange={(e) => setStatus((e.target.value || undefined) as RoomStatus | undefined)}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="INACTIVE">Vô hiệu</option></select>
        <select className="h-10 rounded-md border border-input bg-white px-3 text-sm" value={category ?? ''} onChange={(e) => setCategory((e.target.value || undefined) as ClsRoomCategory | undefined)}><option value="">Tất cả chuyên môn</option><option value="LAB">Xét nghiệm</option><option value="XRAY">X-quang</option><option value="ULTRASOUND">Siêu âm</option><option value="ECG">Chụp điện tim</option></select>
      </div>
      <Card className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/60 text-left"><tr><th className="p-4">Mã phòng</th><th className="p-4">Tên phòng</th><th className="p-4">Chuyên môn</th><th className="p-4">Chuyên khoa</th><th className="p-4">Loại xét nghiệm/kỹ thuật</th><th className="p-4">Trạng thái</th><th className="p-4">Hành động</th></tr></thead><tbody>
        {isLoading ? <tr><td colSpan={7} className="p-8 text-center">Đang tải...</td></tr> : error ? <tr><td colSpan={7} className="p-8 text-center text-destructive">Không thể tải danh sách phòng CLS.</td></tr> : rooms.length === 0 ? <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Không có thông tin phòng CLS.</td></tr> : rooms.map((room) => <tr key={room.id} className="border-t"><td className="p-4 font-medium">{room.code}</td><td className="p-4">{room.name}</td><td className="p-4">{room.clsCategory ? <Badge variant="default">{clsCategoryLabel[room.clsCategory]}</Badge> : '—'}</td><td className="p-4 text-muted-foreground">{room.specialtyName ?? '—'}</td><td className="p-4">{room.techniqueType || '—'}</td><td className="p-4"><Badge variant={room.status === 'ACTIVE' ? 'success' : 'warning'}>{room.status === 'ACTIVE' ? 'Hoạt động' : 'Vô hiệu'}</Badge></td><td className="p-4"><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => openEdit(room)}><Pencil className="h-4 w-4" />Sửa</Button>{room.status === 'ACTIVE' ? <Button size="sm" variant="danger" onClick={() => deactivate(room)}><XCircle className="h-4 w-4" />Vô hiệu</Button> : <Button size="sm" onClick={() => actions.activate.mutate(room.id, { onSuccess: () => push({ title: 'Đã kích hoạt phòng CLS', variant: 'success' }) })}><CheckCircle2 className="h-4 w-4" />Kích hoạt</Button>}</div></td></tr>)}
      </tbody></table></Card>
    </section>

    <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Cập nhật phòng CLS' : 'Tạo phòng CLS'}><form className="space-y-4" onSubmit={submit}><label className="block space-y-1"><span className="text-sm font-medium">Tên phòng *</span><Input required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="block space-y-1"><span className="text-sm font-medium">Chuyên môn *</span><select required className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={form.clsCategory} onChange={(e) => setForm({ ...form, clsCategory: e.target.value as ClsRoomCategory | '' })}><option value="">-- Chọn chuyên môn --</option><option value="LAB">Xét nghiệm</option><option value="XRAY">X-quang</option><option value="ULTRASOUND">Siêu âm</option><option value="ECG">Chụp điện tim</option></select></label><label className="block space-y-1"><span className="text-sm font-medium">Chuyên khoa</span><select className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm" value={form.specialtyId} onChange={(e) => setForm({ ...form, specialtyId: e.target.value })}><option value="">Không thuộc chuyên khoa nào</option>{specialties.map((specialty) => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select></label><label className="block space-y-1"><span className="text-sm font-medium">Loại xét nghiệm/kỹ thuật phụ trách *</span><Input required maxLength={150} value={form.techniqueType} onChange={(e) => setForm({ ...form, techniqueType: e.target.value })} placeholder="Ví dụ: Xét nghiệm máu, X-quang" /></label><label className="block space-y-1"><span className="text-sm font-medium">Mô tả</span><textarea className="min-h-24 w-full rounded-md border border-input p-3 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Hủy</Button><Button type="submit" disabled={actions.create.isPending || actions.update.isPending}>Lưu</Button></div></form></Modal>

    <Dialog open={Boolean(confirmRoom)} onClose={() => setConfirmRoom(null)} title="Phòng còn phiếu CLS chưa hoàn thành" description={`Có ${unfinishedOrders} phiếu đang chờ hoặc đang thực hiện.`}><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConfirmRoom(null)}>Hủy</Button><Button variant="danger" onClick={() => confirmRoom && deactivate(confirmRoom, true)}>Vẫn vô hiệu hóa</Button></div></Dialog>
  </div>;
}
