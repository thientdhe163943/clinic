'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ExpandableTextInput } from '@/components/shared/expandable-text-input';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSupplierList,
  useUpdateSupplier,
} from '@/hooks/use-suppliers';
import type { CreateSupplierRequest, Supplier, UpdateSupplierRequest } from '@/types/suppliers';

// ─── Form ─────────────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
}

const PHONE_PATTERN = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SupplierFormProps {
  initial?: Supplier;
  onSubmit: (data: CreateSupplierRequest) => void;
  onCancel: () => void;
  loading: boolean;
  submitLabel: string;
}

function SupplierForm({ initial, onSubmit, onCancel, loading, submitLabel }: SupplierFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Tên nhà cung cấp không được để trống';
    else if (name.trim().length > 150) next.name = 'Tên nhà cung cấp tối đa 150 ký tự';
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) next.phone = 'Số điện thoại không hợp lệ (VD: 0912345678)';
    if (email.trim() && !EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Tên nhà cung cấp <span className="text-destructive">*</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Công ty Dược phẩm ABC" maxLength={150} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Số điện thoại</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="VD: 0912345678" />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="VD: contact@abc.com" />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">Địa chỉ</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Địa chỉ (tùy chọn)" />
        </div>

        <div className="space-y-1 md:col-span-2">
          <ExpandableTextInput
            label="Mô tả"
            value={description}
            onChange={setDescription}
            placeholder="Mô tả ngắn (tùy chọn)"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Đang lưu...' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  supplier: Supplier;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirm({ supplier, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Bạn có chắc muốn xóa nhà cung cấp <span className="font-semibold">{supplier.name}</span>? Hành động này không thể hoàn tác.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? 'Đang xóa...' : 'Xóa'}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSuppliersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data, isLoading, isError, error } = useSupplierList({ search: search || undefined, page, limit: 10 });
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  // If the current page becomes out of range (e.g. after deleting the last
  // item on the last page), clamp back to the new last page instead of
  // showing an empty table with no visible pagination controls to escape it
  // (Pagination hides itself once totalPages <= 1).
  useEffect(() => {
    if (data?.meta && data.meta.totalPages > 0 && data.meta.page > data.meta.totalPages) {
      setPage(data.meta.totalPages);
    }
  }, [data?.meta]);

  const handleCreate = (req: CreateSupplierRequest) => {
    createMutation.mutate(req, { onSuccess: () => setCreateOpen(false) });
  };

  const handleUpdate = (req: UpdateSupplierRequest) => {
    if (!editTarget) return;
    updateMutation.mutate({ id: editTarget.id, data: req }, { onSuccess: () => setEditTarget(null) });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const items = data?.items ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;

  function handleSearchChange(value: string) {
    setPage(1);
    setSearch(value);
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Nhà cung cấp"
        description="Danh sách nhà cung cấp vật tư, dược phẩm"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Thêm nhà cung cấp
          </Button>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Tìm kiếm theo tên nhà cung cấp..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Badge variant="muted">{total} nhà cung cấp</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Tên nhà cung cấp</th>
                  <th className="h-10 px-4 font-semibold">SĐT</th>
                  <th className="h-10 px-4 font-semibold">Email</th>
                  <th className="h-10 px-4 font-semibold">Địa chỉ</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="h-32 text-center text-muted-foreground">Đang tải...</td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={5} className="h-32 text-center text-destructive">
                      Lỗi tải dữ liệu: {error?.message ?? 'Vui lòng thử lại'}
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="h-32 text-center text-muted-foreground">Không có dữ liệu</td>
                  </tr>
                )}
                {items.map((supplier) => (
                  <tr key={supplier.id} className="border-t border-border bg-white hover:bg-muted/30 transition-colors">
                    <td className="h-12 px-4 font-medium">{supplier.name}</td>
                    <td className="h-12 px-4 text-muted-foreground">{supplier.phone ?? '—'}</td>
                    <td className="h-12 px-4 text-muted-foreground">{supplier.email ?? '—'}</td>
                    <td className="h-12 px-4 text-muted-foreground max-w-[240px] truncate">{supplier.address ?? '—'}</td>
                    <td className="h-12 px-4">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setEditTarget(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label="Xóa"
                          onClick={() => setDeleteTarget(supplier)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPageChange={setPage} />}
      </section>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm nhà cung cấp" className="max-w-lg">
        <SupplierForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} loading={createMutation.isPending} submitLabel="Tạo nhà cung cấp" />
      </Dialog>

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Cập nhật nhà cung cấp" className="max-w-lg">
        {editTarget && (
          <SupplierForm
            initial={editTarget}
            onSubmit={(req) => handleUpdate(req)}
            onCancel={() => setEditTarget(null)}
            loading={updateMutation.isPending}
            submitLabel="Cập nhật"
          />
        )}
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xóa nhà cung cấp">
        {deleteTarget && (
          <DeleteConfirm
            supplier={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleteMutation.isPending}
          />
        )}
      </Dialog>
    </div>
  );
}
