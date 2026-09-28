'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import {
  useCreateSpecialty,
  useDeleteSpecialty,
  useSpecialtyOptions,
  useUpdateSpecialty,
} from '@/hooks/use-doctor-specialties';
import type { SpecialtyOption } from '@/types/doctor-specialties';

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormProps {
  onSubmit: (name: string, description?: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function CreateForm({ onSubmit, onCancel, loading }: CreateFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tên chuyên khoa không được để trống');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Tên chuyên khoa tối đa 100 ký tự');
      return;
    }
    onSubmit(trimmedName, description.trim() || undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Tên chuyên khoa <span className="text-destructive">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          placeholder="VD: Tim mạch, Nội khoa, Da liễu..."
          maxLength={100}
          autoFocus
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mô tả</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn về chuyên khoa..."
          rows={3}
          className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Tạo chuyên khoa'}
        </Button>
      </div>
    </form>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  initial: SpecialtyOption;
  onSubmit: (name: string, description?: string) => void;
  onCancel: () => void;
  loading: boolean;
}

function EditForm({ initial, onSubmit, onCancel, loading }: EditFormProps) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Tên chuyên khoa không được để trống');
      return;
    }
    if (trimmedName.length > 100) {
      setError('Tên chuyên khoa tối đa 100 ký tự');
      return;
    }
    onSubmit(trimmedName, description.trim() || undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Tên chuyên khoa <span className="text-destructive">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          maxLength={100}
          autoFocus
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mô tả</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
          Hủy
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Cập nhật'}
        </Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSpecialtiesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<SpecialtyOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpecialtyOption | null>(null);
  const [search, setSearch] = useState('');

  const { data: specialties = [], isLoading, isError, error } = useSpecialtyOptions();
  const createSpecialty = useCreateSpecialty();
  const updateSpecialty = useUpdateSpecialty();
  const deleteSpecialty = useDeleteSpecialty();

  const filtered = search.trim()
    ? specialties.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : specialties;

  function handleCreate(name: string, description?: string) {
    createSpecialty.mutate({ name, description }, { onSuccess: () => setShowCreate(false) });
  }

  function handleUpdate(name: string, description?: string) {
    if (!editTarget) return;
    updateSpecialty.mutate(
      { id: editTarget.id, data: { name, description } },
      { onSuccess: () => setEditTarget(null) },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteSpecialty.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  return (
    <main>
      <PageHeader
        title="Danh sách chuyên khoa"
        description="Quản lý các chuyên khoa trong hệ thống"
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Input
              className="w-64"
              placeholder="Tìm chuyên khoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Badge variant="muted">{filtered.length} chuyên khoa</Badge>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm chuyên khoa
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">STT</th>
                  <th className="h-10 px-4 font-semibold">Tên chuyên khoa</th>
                  <th className="h-10 px-4 font-semibold">Mô tả</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={4} className="h-32 text-center text-muted-foreground">Đang tải...</td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={4} className="h-32 text-center text-destructive">
                      Lỗi tải dữ liệu: {(error as Error)?.message ?? 'Vui lòng thử lại'}
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="h-32 text-center text-muted-foreground">
                      {search ? 'Không tìm thấy chuyên khoa phù hợp' : 'Chưa có chuyên khoa nào'}
                    </td>
                  </tr>
                )}
                {filtered.map((specialty, index) => (
                  <tr
                    key={specialty.id}
                    className="border-t border-border bg-white transition-colors hover:bg-muted/30"
                  >
                    <td className="h-14 w-14 px-4 text-muted-foreground">{index + 1}</td>
                    <td className="h-14 px-4">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{specialty.name}</span>
                      </div>
                    </td>
                    <td className="h-14 px-4 text-muted-foreground">
                      {specialty.description ?? <span className="italic text-muted-foreground/60">Không có mô tả</span>}
                    </td>
                    <td className="h-14 px-4">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Sửa"
                          onClick={() => setEditTarget(specialty)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Xóa"
                          onClick={() => setDeleteTarget(specialty)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Thêm chuyên khoa mới">
        <CreateForm
          onSubmit={handleCreate}
          onCancel={() => setShowCreate(false)}
          loading={createSpecialty.isPending}
        />
      </Dialog>

      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Chỉnh sửa chuyên khoa"
      >
        {editTarget && (
          <EditForm
            initial={editTarget}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={updateSpecialty.isPending}
          />
        )}
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Xóa chuyên khoa"
        description={`Bạn có chắc muốn xóa chuyên khoa "${deleteTarget?.name}"? Không thể hoàn tác.`}
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteSpecialty.isPending}>
            Hủy
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleteSpecialty.isPending}>
            {deleteSpecialty.isPending ? 'Đang xóa...' : 'Xóa'}
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
