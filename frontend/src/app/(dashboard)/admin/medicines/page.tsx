'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ExpandableTextInput } from '@/components/shared/expandable-text-input';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import {
  useAdminMedicineList,
  useCreateMedicine,
  useDeleteMedicine,
  useUpdateMedicine,
} from '@/hooks/use-medicines';
import { MEASUREMENT_UNIT_LABEL, MEASUREMENT_UNIT_OPTIONS } from '@/types/supplies';
import type { MeasurementUnit } from '@/types/supplies';
import type { AdminMedicine, CreateMedicineRequest, UpdateMedicineRequest } from '@/types/medicines';

function formatPrice(price: number | null) {
  if (price === null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function formatUnit(unit: MeasurementUnit) {
  return MEASUREMENT_UNIT_LABEL[unit] ?? unit;
}

// ─── Create Form ──────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string;
  activeIngredient?: string;
  dosageForm?: string;
  unit?: string;
  price?: string;
}

interface CreateFormProps {
  onSubmit: (data: CreateMedicineRequest) => void;
  onCancel: () => void;
  loading: boolean;
}

function CreateForm({ onSubmit, onCancel, loading }: CreateFormProps) {
  const [name, setName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dosageForm, setDosageForm] = useState('');
  const [unit, setUnit] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [contraindications, setContraindications] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Tên thuốc không được để trống';
    else if (name.trim().length > 150) next.name = 'Tên thuốc tối đa 150 ký tự';
    if (!activeIngredient.trim()) next.activeIngredient = 'Hoạt chất không được để trống';
    if (!dosageForm.trim()) next.dosageForm = 'Dạng bào chế không được để trống';
    if (!unit) next.unit = 'Vui lòng chọn đơn vị';
    const p = Number(price);
    if (!price || isNaN(p) || p <= 0) next.price = 'Giá phải là số dương';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      activeIngredient: activeIngredient.trim(),
      dosageForm: dosageForm.trim(),
      unit: unit as MeasurementUnit,
      price: Number(price),
      description: description.trim() || undefined,
      contraindications: contraindications.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Tên thuốc <span className="text-destructive">*</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Paracetamol 500mg" maxLength={150} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Hoạt chất <span className="text-destructive">*</span>
          </label>
          <Input value={activeIngredient} onChange={(e) => setActiveIngredient(e.target.value)} placeholder="VD: Paracetamol" maxLength={200} />
          {errors.activeIngredient && <p className="text-xs text-destructive">{errors.activeIngredient}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Dạng bào chế <span className="text-destructive">*</span>
          </label>
          <Input value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} placeholder="VD: Viên nén" maxLength={50} />
          {errors.dosageForm && <p className="text-xs text-destructive">{errors.dosageForm}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Đơn vị <span className="text-destructive">*</span>
          </label>
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">Chọn đơn vị</option>
            {MEASUREMENT_UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Giá (VNĐ) <span className="text-destructive">*</span>
          </label>
          <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="VD: 2000" />
          {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <ExpandableTextInput
            label="Mô tả"
            value={description}
            onChange={setDescription}
            placeholder="Mô tả ngắn về thuốc (tùy chọn)"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <ExpandableTextInput
            label="Chống chỉ định"
            value={contraindications}
            onChange={setContraindications}
            placeholder="Chống chỉ định (tùy chọn)"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Tạo thuốc'}
        </Button>
      </div>
    </form>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormProps {
  initial: AdminMedicine;
  onSubmit: (data: UpdateMedicineRequest) => void;
  onCancel: () => void;
  loading: boolean;
}

function EditForm({ initial, onSubmit, onCancel, loading }: EditFormProps) {
  const [name, setName] = useState(initial.name);
  const [activeIngredient, setActiveIngredient] = useState(initial.activeIngredient);
  const [dosageForm, setDosageForm] = useState(initial.dosageForm);
  const [unit, setUnit] = useState<string>(initial.unit);
  const [price, setPrice] = useState(initial.price !== null ? String(initial.price) : '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [contraindications, setContraindications] = useState(initial.contraindications ?? '');
  const [isActive, setIsActive] = useState(initial.isActive);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!name.trim()) next.name = 'Tên thuốc không được để trống';
    else if (name.trim().length > 150) next.name = 'Tên thuốc tối đa 150 ký tự';
    if (!activeIngredient.trim()) next.activeIngredient = 'Hoạt chất không được để trống';
    if (!dosageForm.trim()) next.dosageForm = 'Dạng bào chế không được để trống';
    if (!unit) next.unit = 'Vui lòng chọn đơn vị';
    const p = Number(price);
    if (!price || isNaN(p) || p <= 0) next.price = 'Giá phải là số dương';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      activeIngredient: activeIngredient.trim(),
      dosageForm: dosageForm.trim(),
      unit: unit as MeasurementUnit,
      price: Number(price),
      description: description.trim() || undefined,
      contraindications: contraindications.trim() || undefined,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Tên thuốc <span className="text-destructive">*</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Hoạt chất <span className="text-destructive">*</span>
          </label>
          <Input value={activeIngredient} onChange={(e) => setActiveIngredient(e.target.value)} maxLength={200} />
          {errors.activeIngredient && <p className="text-xs text-destructive">{errors.activeIngredient}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Dạng bào chế <span className="text-destructive">*</span>
          </label>
          <Input value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} maxLength={50} />
          {errors.dosageForm && <p className="text-xs text-destructive">{errors.dosageForm}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">
            Đơn vị <span className="text-destructive">*</span>
          </label>
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {MEASUREMENT_UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
          {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">
            Giá (VNĐ) <span className="text-destructive">*</span>
          </label>
          <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
          {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
        </div>

        <div className="space-y-1 md:col-span-2">
          <ExpandableTextInput
            label="Mô tả"
            value={description}
            onChange={setDescription}
            placeholder="Mô tả ngắn về thuốc (tùy chọn)"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <ExpandableTextInput
            label="Chống chỉ định"
            value={contraindications}
            onChange={setContraindications}
            placeholder="Chống chỉ định (tùy chọn)"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-foreground">Trạng thái <span className="text-destructive">*</span></label>
          <select
            value={isActive ? 'active' : 'inactive'}
            onChange={(e) => setIsActive(e.target.value === 'active')}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="active">Đang dùng</option>
            <option value="inactive">Ngừng dùng</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Cập nhật'}
        </Button>
      </div>
    </form>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  medicine: AdminMedicine;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirm({ medicine, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Bạn có chắc muốn xóa thuốc <span className="font-semibold">{medicine.name}</span>? Hành động này không thể hoàn tác.
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

export default function AdminMedicinesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminMedicine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminMedicine | null>(null);

  const { data, isLoading, isError, error } = useAdminMedicineList({ search: search || undefined, page, limit: 10 });
  const createMutation = useCreateMedicine();
  const updateMutation = useUpdateMedicine();
  const deleteMutation = useDeleteMedicine();

  // If the current page becomes out of range (e.g. after deleting the last
  // item on the last page), clamp back to the new last page instead of
  // showing an empty table with no visible pagination controls to escape it
  // (Pagination hides itself once totalPages <= 1).
  useEffect(() => {
    if (data?.meta && data.meta.totalPages > 0 && data.meta.page > data.meta.totalPages) {
      setPage(data.meta.totalPages);
    }
  }, [data?.meta]);

  const handleCreate = (req: CreateMedicineRequest) => {
    createMutation.mutate(req, { onSuccess: () => setCreateOpen(false) });
  };

  const handleUpdate = (req: UpdateMedicineRequest) => {
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
        title="Danh mục thuốc"
        description="Thuốc, hoạt chất, giá bán và chống chỉ định"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Thêm thuốc
          </Button>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Tìm kiếm theo tên hoặc hoạt chất..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Badge variant="muted">{total} thuốc</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Tên thuốc</th>
                  <th className="h-10 px-4 font-semibold">Hoạt chất</th>
                  <th className="h-10 px-4 font-semibold">Dạng bào chế</th>
                  <th className="h-10 px-4 font-semibold">Đơn vị</th>
                  <th className="h-10 px-4 font-semibold">Giá</th>
                  <th className="h-10 px-4 font-semibold">Trạng thái</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-muted-foreground">Đang tải...</td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-destructive">
                      Lỗi tải dữ liệu: {error?.message ?? 'Vui lòng thử lại'}
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-muted-foreground">Không có dữ liệu</td>
                  </tr>
                )}
                {items.map((med) => (
                  <tr key={med.id} className="border-t border-border bg-white hover:bg-muted/30 transition-colors">
                    <td className="h-12 px-4 font-medium">{med.name}</td>
                    <td className="h-12 px-4 text-muted-foreground">{med.activeIngredient}</td>
                    <td className="h-12 px-4 text-muted-foreground">{med.dosageForm}</td>
                    <td className="h-12 px-4 text-muted-foreground">{formatUnit(med.unit)}</td>
                    <td className="h-12 px-4 tabular-nums">{formatPrice(med.price)}</td>
                    <td className="h-12 px-4">
                      <Badge variant={med.isActive ? 'success' : 'danger'}>
                        {med.isActive ? 'Đang dùng' : 'Ngừng dùng'}
                      </Badge>
                    </td>
                    <td className="h-12 px-4">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setEditTarget(med)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label="Xóa"
                          onClick={() => setDeleteTarget(med)}
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm thuốc mới" className="max-w-lg">
        <CreateForm onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} loading={createMutation.isPending} />
      </Dialog>

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Cập nhật thuốc" className="max-w-lg">
        {editTarget && (
          <EditForm
            initial={editTarget}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xóa thuốc">
        {deleteTarget && (
          <DeleteConfirm
            medicine={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleteMutation.isPending}
          />
        )}
      </Dialog>
    </div>
  );
}
