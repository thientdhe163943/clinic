'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  History,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ExpandableTextInput } from '@/components/shared/expandable-text-input';
import { PageHeader } from '@/components/shared/page-header';
import { ViewFullTextButton } from '@/components/shared/view-full-text-button';
import { Pagination } from '@/components/shared/pagination';
import {
  useCreateSupply,
  useCreateSupplyCategory,
  useDeleteSupply,
  useDeleteSupplyCategory,
  useDistributeSupply,
  useImportSupplies,
  useSupplyCategories,
  useSupplyList,
  useUpdateSupply,
  useUpdateSupplyCategory,
} from '@/hooks/use-supplies';
import { useRooms } from '@/hooks/use-rooms';
import { useSuppliers } from '@/hooks/use-suppliers';
import { todayDateString } from '@/lib/utils/date';
import { useNotificationStore } from '@/stores/notification.store';
import { MEASUREMENT_UNIT_LABEL, MEASUREMENT_UNIT_OPTIONS } from '@/types/supplies';
import type {
  CreateSupplyRequest,
  ImportSupplyLine,
  MeasurementUnit,
  Supply,
  SupplyCategory,
  SupplyStockStatus,
  UpdateSupplyRequest,
} from '@/types/supplies';

function formatNumber(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatUnit(unit: MeasurementUnit) {
  return MEASUREMENT_UNIT_LABEL[unit] ?? unit;
}

function StockBadge({ supply }: { supply: Supply }) {
  if (supply.currentStock <= 0) {
    return <Badge variant="danger">Hết hàng</Badge>;
  }
  if (supply.isLowStock) {
    return <Badge variant="warning">Sắp hết</Badge>;
  }
  return <Badge variant="success">Đủ hàng</Badge>;
}

// ─── Create / Edit supply form ──────────────────────────────────────────────

interface SupplyFormErrors {
  name?: string;
  categoryId?: string;
  unit?: string;
  minStockLevel?: string;
}

function validateSupplyFields(name: string, categoryId: string, unit: string, minStockLevel: string): SupplyFormErrors {
  const errors: SupplyFormErrors = {};
  if (!name.trim()) errors.name = 'Tên vật tư không được để trống';
  else if (name.trim().length > 150) errors.name = 'Tên vật tư tối đa 150 ký tự';
  if (!categoryId) errors.categoryId = 'Vui lòng chọn danh mục';
  if (!unit) errors.unit = 'Vui lòng chọn đơn vị tính';
  const min = Number(minStockLevel);
  if (minStockLevel === '' || isNaN(min) || min < 0 || !Number.isInteger(min)) {
    errors.minStockLevel = 'Mức tồn kho tối thiểu phải là số nguyên không âm';
  }
  return errors;
}

function CreateSupplyForm({
  categories,
  onSubmit,
  onCancel,
  loading,
}: {
  categories: SupplyCategory[];
  onSubmit: (data: CreateSupplyRequest) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [description, setDescription] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('0');
  const [errors, setErrors] = useState<SupplyFormErrors>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = validateSupplyFields(name, categoryId, unit, minStockLevel);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      name: name.trim(),
      categoryId,
      unit: unit as MeasurementUnit,
      description: description.trim() || undefined,
      minStockLevel: Number(minStockLevel),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Tên vật tư <span className="text-destructive">*</span></label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Kim tiêm 5ml" maxLength={150} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Danh mục <span className="text-destructive">*</span></label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Chọn danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Đơn vị tính <span className="text-destructive">*</span></label>
        <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">Chọn đơn vị tính</option>
          {MEASUREMENT_UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mức tồn kho tối thiểu <span className="text-destructive">*</span></label>
        <Input type="number" min={0} value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} />
        {errors.minStockLevel && <p className="text-xs text-destructive">{errors.minStockLevel}</p>}
      </div>
      <div className="space-y-1">
        <ExpandableTextInput
          label="Mô tả"
          value={description}
          onChange={setDescription}
          placeholder="Mô tả ngắn (tùy chọn)"
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Đang lưu...' : 'Tạo vật tư'}</Button>
      </div>
    </form>
  );
}

function EditSupplyForm({
  initial,
  categories,
  onSubmit,
  onCancel,
  loading,
}: {
  initial: Supply;
  categories: SupplyCategory[];
  onSubmit: (data: UpdateSupplyRequest) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [unit, setUnit] = useState<string>(initial.unit);
  const [description, setDescription] = useState(initial.description ?? '');
  const [minStockLevel, setMinStockLevel] = useState(initial.minStockLevel.toString());
  const [isActive, setIsActive] = useState(initial.isActive);
  const [errors, setErrors] = useState<SupplyFormErrors>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const next = validateSupplyFields(name, categoryId, unit, minStockLevel);
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSubmit({
      name: name.trim(),
      categoryId,
      unit: unit as MeasurementUnit,
      description: description.trim() || undefined,
      minStockLevel: Number(minStockLevel),
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Tên vật tư <span className="text-destructive">*</span></label>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Danh mục <span className="text-destructive">*</span></label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        {errors.categoryId && <p className="text-xs text-destructive">{errors.categoryId}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Đơn vị tính <span className="text-destructive">*</span></label>
        <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
          {MEASUREMENT_UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </Select>
        {errors.unit && <p className="text-xs text-destructive">{errors.unit}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mức tồn kho tối thiểu <span className="text-destructive">*</span></label>
        <Input type="number" min={0} value={minStockLevel} onChange={(e) => setMinStockLevel(e.target.value)} />
        {errors.minStockLevel && <p className="text-xs text-destructive">{errors.minStockLevel}</p>}
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mô tả</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          Tồn kho hiện tại: <span className="font-medium text-foreground">{formatNumber(initial.currentStock)} {formatUnit(initial.unit)}</span> (không thể chỉnh sửa trực tiếp)
        </p>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Trạng thái <span className="text-destructive">*</span></label>
        <Select value={isActive ? 'active' : 'inactive'} onChange={(e) => setIsActive(e.target.value === 'active')}>
          <option value="active">Hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Đang lưu...' : 'Cập nhật'}</Button>
      </div>
    </form>
  );
}

function DeleteSupplyConfirm({
  supply,
  onConfirm,
  onCancel,
  loading,
}: {
  supply: Supply;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Bạn có chắc muốn xóa vật tư <span className="font-semibold">{supply.name}</span>? Vật tư còn tồn kho hoặc đã có lịch sử giao dịch sẽ không thể xóa.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>{loading ? 'Đang xóa...' : 'Xóa'}</Button>
      </div>
    </div>
  );
}

// ─── Category manager dialog ────────────────────────────────────────────────

function CategoryManagerDialog({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: SupplyCategory[] }) {
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SupplyCategory | null>(null);
  const push = useNotificationStore((s) => s.push);

  const createMutation = useCreateSupplyCategory();
  const updateMutation = useUpdateSupplyCategory();
  const deleteMutation = useDeleteSupplyCategory();

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      push({ variant: 'warning', title: 'Tên danh mục không được để trống' });
      return;
    }
    createMutation.mutate(
      { name: newName.trim(), description: newDescription.trim() || undefined },
      { onSuccess: () => { setNewName(''); setNewDescription(''); } },
    );
  };

  const startEdit = (category: SupplyCategory) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditDescription(category.description ?? '');
  };

  const handleUpdate = (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    if (!editName.trim()) {
      push({ variant: 'warning', title: 'Tên danh mục không được để trống' });
      return;
    }
    updateMutation.mutate(
      { id: editingId, data: { name: editName.trim(), description: editDescription.trim() || undefined } },
      { onSuccess: () => setEditingId(null) },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Quản lý danh mục vật tư" className="max-w-lg">
      <div className="space-y-4">
        <form onSubmit={handleCreate} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-foreground">Tên danh mục mới</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="VD: Vật tư tiêu hao" maxLength={100} />
          </div>
          <div className="flex-1 space-y-1">
            <ExpandableTextInput
              label="Mô tả"
              value={newDescription}
              onChange={setNewDescription}
              placeholder="Tùy chọn"
            />
          </div>
          <Button type="submit" size="sm" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" />
            Thêm
          </Button>
        </form>

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {categories.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có danh mục nào</p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="rounded-md border border-border p-3">
              {editingId === cat.id ? (
                <form onSubmit={handleUpdate} className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={100} />
                  <ExpandableTextInput
                    label="Mô tả"
                    value={editDescription}
                    onChange={setEditDescription}
                    placeholder="Mô tả"
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>Hủy</Button>
                    <Button type="submit" size="sm" disabled={updateMutation.isPending}>Lưu</Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{cat.name}</p>
                    {cat.description && (
                      <div className="flex items-center gap-1">
                        <p className="truncate text-xs text-muted-foreground">{cat.description}</p>
                        <ViewFullTextButton label="Mô tả danh mục" text={cat.description} />
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => startEdit(cat)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost" aria-label="Xóa"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xóa danh mục">
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Xóa danh mục <span className="font-semibold">{deleteTarget.name}</span>? Danh mục còn vật tư sẽ không thể xóa.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>Hủy</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Đang xóa...' : 'Xóa'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Dialog>
  );
}

// ─── Import dialog ──────────────────────────────────────────────────────────

const emptyLine: ImportSupplyLine = { supplyId: '', quantity: 1, unitPrice: 0, expiryDate: '' };

function ImportDialog({ open, onClose, supplies }: { open: boolean; onClose: () => void; supplies: Supply[] }) {
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<ImportSupplyLine[]>([{ ...emptyLine }]);
  const { data: suppliers = [], isLoading: loadingSuppliers } = useSuppliers();
  const importMutation = useImportSupplies();
  const push = useNotificationStore((s) => s.push);

  useEffect(() => {
    if (open) {
      setSupplierId('');
      setLines([{ ...emptyLine }]);
    }
  }, [open]);

  const updateLine = (index: number, patch: Partial<ImportSupplyLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, { ...emptyLine }]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const total = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      push({ variant: 'warning', title: 'Vui lòng chọn nhà cung cấp' });
      return;
    }
    for (const line of lines) {
      if (!line.supplyId) {
        push({ variant: 'warning', title: 'Vui lòng chọn vật tư cho tất cả các dòng' });
        return;
      }
      if (!Number.isInteger(Number(line.quantity)) || Number(line.quantity) <= 0) {
        push({ variant: 'warning', title: 'Số lượng nhập phải là số nguyên dương' });
        return;
      }
      if (isNaN(Number(line.unitPrice)) || Number(line.unitPrice) < 0) {
        push({ variant: 'warning', title: 'Giá nhập không được âm' });
        return;
      }
    }

    importMutation.mutate(
      {
        supplierId,
        items: lines.map((line) => ({
          supplyId: line.supplyId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          expiryDate: line.expiryDate || undefined,
        })),
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nhập kho vật tư"
      description="Chọn nhà cung cấp và các dòng vật tư cần nhập"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Nhà cung cấp <span className="text-destructive">*</span></label>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={loadingSuppliers}>
            <option value="">Chọn nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>

        <div className="max-h-80 space-y-3 overflow-y-auto">
          {lines.map((line, index) => (
            <div key={index} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Dòng {index + 1}</p>
                {lines.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" aria-label="Xóa dòng" onClick={() => removeLine(index)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-foreground">Vật tư <span className="text-destructive">*</span></label>
                  <Select value={line.supplyId} onChange={(e) => updateLine(index, { supplyId: e.target.value })}>
                    <option value="">Chọn vật tư</option>
                    {supplies.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({formatUnit(s.unit)})</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Số lượng <span className="text-destructive">*</span></label>
                  <Input
                    type="number" min={1}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Giá nhập (VNĐ) <span className="text-destructive">*</span></label>
                  <Input
                    type="number" min={0}
                    // Rendering `0` as the literal string "0" leaves it stuck as a
                    // leading digit when typing (e.g. "0" + "5" → "05" instead of
                    // replacing it) — showing an empty field until a real amount
                    // is entered lets the user just type the number directly.
                    value={line.unitPrice === 0 ? '' : line.unitPrice}
                    onChange={(e) => updateLine(index, { unitPrice: e.target.value === '' ? 0 : Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Hạn sử dụng</label>
                  <Input
                    type="date"
                    min={todayDateString()}
                    value={line.expiryDate ?? ''}
                    onChange={(e) => updateLine(index, { expiryDate: e.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={addLine}>
          <Plus className="h-4 w-4" />
          Thêm dòng vật tư
        </Button>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">Tổng giá trị tạm tính</p>
          <p className="text-sm font-semibold text-foreground">{formatCurrency(total)}</p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={importMutation.isPending}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={importMutation.isPending}>
            {importMutation.isPending ? 'Đang nhập...' : 'Xác nhận nhập kho'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ─── Distribute dialog ──────────────────────────────────────────────────────

function DistributeDialog({
  open,
  onClose,
  supplies,
  preselectedSupplyId,
}: {
  open: boolean;
  onClose: () => void;
  supplies: Supply[];
  preselectedSupplyId: string | null;
}) {
  const [supplyId, setSupplyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const { data: rooms = [], isLoading: loadingRooms } = useRooms();
  const distributeMutation = useDistributeSupply();
  const push = useNotificationStore((s) => s.push);

  useEffect(() => {
    if (open) {
      setSupplyId(preselectedSupplyId ?? '');
      setRoomId('');
      setQuantity('1');
    }
  }, [open, preselectedSupplyId]);

  const activeRooms = useMemo(() => rooms.filter((r) => r.status === 'ACTIVE'), [rooms]);
  const selectedSupply = useMemo(() => supplies.find((s) => s.id === supplyId) ?? null, [supplies, supplyId]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!supplyId) {
      push({ variant: 'warning', title: 'Vui lòng chọn vật tư' });
      return;
    }
    if (!roomId) {
      push({ variant: 'warning', title: 'Vui lòng chọn phòng nhận' });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      push({ variant: 'warning', title: 'Số lượng phân phối phải là số nguyên dương' });
      return;
    }
    if (selectedSupply && qty > selectedSupply.currentStock) {
      push({ variant: 'warning', title: `Tồn kho hiện tại chỉ còn ${formatNumber(selectedSupply.currentStock)} ${formatUnit(selectedSupply.unit)}` });
      return;
    }

    distributeMutation.mutate(
      { supplyId, roomId, quantity: qty },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Phân phối vật tư cho phòng" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Vật tư <span className="text-destructive">*</span></label>
          <Select value={supplyId} onChange={(e) => setSupplyId(e.target.value)}>
            <option value="">Chọn vật tư</option>
            {supplies.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — còn {formatNumber(s.currentStock)} {formatUnit(s.unit)}</option>
            ))}
          </Select>
          {selectedSupply && (
            <p className="text-xs text-muted-foreground">
              Tồn kho hiện tại: <span className="font-medium text-foreground">{formatNumber(selectedSupply.currentStock)} {formatUnit(selectedSupply.unit)}</span>
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Phòng nhận <span className="text-destructive">*</span></label>
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={loadingRooms}>
            <option value="">Chọn phòng</option>
            {activeRooms.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Số lượng <span className="text-destructive">*</span></label>
          <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={distributeMutation.isPending}>Hủy</Button>
          <Button type="submit" variant="primary" disabled={distributeMutation.isPending}>
            {distributeMutation.isPending ? 'Đang phân phối...' : 'Xác nhận phân phối'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminSuppliesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<SupplyStockStatus | ''>('');
  const [page, setPage] = useState(1);

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supply | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [distributeOpen, setDistributeOpen] = useState(false);
  const [distributeSupplyId, setDistributeSupplyId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useSupplyList({
    search: search || undefined,
    category: category || undefined,
    status: status || undefined,
    page,
    limit: 10,
  });
  const { data: categories = [] } = useSupplyCategories();
  // 100 = ListSuppliesQueryDto's hard ceiling (PaginationDto's @Max(100)) — a
  // higher value 400s the whole request (class-validator rejects it before
  // the handler runs), which silently emptied this picker dropdown entirely.
  const { data: allSuppliesData } = useSupplyList({ limit: 100 });

  const createMutation = useCreateSupply();
  const updateMutation = useUpdateSupply();
  const deleteMutation = useDeleteSupply();

  // If the current page becomes out of range (e.g. after deleting the last
  // item on the last page), clamp back to the new last page instead of
  // showing an empty table with no visible pagination controls to escape it
  // (Pagination hides itself once totalPages <= 1).
  useEffect(() => {
    if (data?.meta && data.meta.totalPages > 0 && data.meta.page > data.meta.totalPages) {
      setPage(data.meta.totalPages);
    }
  }, [data?.meta]);

  const items = data?.items ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const pickerSupplies = useMemo(
    () => (allSuppliesData?.items ?? []).filter((s) => s.isActive),
    [allSuppliesData],
  );

  const handleSearchChange = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const handleCategoryChange = (value: string) => {
    setPage(1);
    setCategory(value);
  };

  const handleStatusChange = (value: string) => {
    setPage(1);
    setStatus(value as SupplyStockStatus | '');
  };

  const handleCreate = (req: CreateSupplyRequest) => {
    createMutation.mutate(req, { onSuccess: () => setCreateOpen(false) });
  };

  const handleUpdate = (req: UpdateSupplyRequest) => {
    if (!editTarget) return;
    updateMutation.mutate({ id: editTarget.id, data: req }, { onSuccess: () => setEditTarget(null) });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const openDistribute = (supplyId: string | null) => {
    setDistributeSupplyId(supplyId);
    setDistributeOpen(true);
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Vật tư y tế"
        description="Tồn kho, nhập kho và cấp phát vật tư cho các phòng"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCategoriesOpen(true)}>
              <Tags className="h-4 w-4" />
              Quản lý danh mục
            </Button>
            <Button variant="secondary" size="sm" onClick={() => openDistribute(null)}>
              <PackageMinus className="h-4 w-4" />
              Phân phối
            </Button>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <PackagePlus className="h-4 w-4" />
              Nhập kho
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Thêm vật tư
            </Button>
          </div>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm theo tên vật tư..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <Select className="sm:w-48" value={category} onChange={(e) => handleCategoryChange(e.target.value)}>
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select className="sm:w-48" value={status} onChange={(e) => handleStatusChange(e.target.value)}>
              <option value="">Tất cả trạng thái</option>
              <option value="LOW_STOCK">Sắp hết</option>
              <option value="NORMAL">Bình thường</option>
            </Select>
          </div>
          <Badge variant="muted">{total} vật tư</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Tên vật tư</th>
                  <th className="h-10 px-4 font-semibold">Danh mục</th>
                  <th className="h-10 px-4 font-semibold">Tồn kho</th>
                  <th className="h-10 px-4 font-semibold">Mức tối thiểu</th>
                  <th className="h-10 px-4 font-semibold">Đơn vị</th>
                  <th className="h-10 px-4 font-semibold">Trạng thái</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="h-32 text-center text-muted-foreground">Đang tải...</td></tr>
                )}
                {isError && (
                  <tr><td colSpan={7} className="h-32 text-center text-destructive">Lỗi tải dữ liệu: {error?.message ?? 'Vui lòng thử lại'}</td></tr>
                )}
                {!isLoading && !isError && items.length === 0 && (
                  <tr><td colSpan={7} className="h-32 text-center text-muted-foreground">Không có dữ liệu</td></tr>
                )}
                {items.map((supply) => (
                  <tr key={supply.id} className="border-t border-border bg-white transition-colors hover:bg-muted/30">
                    <td className="h-12 px-4 font-medium">{supply.name}</td>
                    <td className="h-12 px-4 text-muted-foreground">{supply.categoryName}</td>
                    <td className="h-12 px-4 tabular-nums">{formatNumber(supply.currentStock)}</td>
                    <td className="h-12 px-4 tabular-nums text-muted-foreground">{formatNumber(supply.minStockLevel)}</td>
                    <td className="h-12 px-4 text-muted-foreground">{formatUnit(supply.unit)}</td>
                    <td className="h-12 px-4"><StockBadge supply={supply} /></td>
                    <td className="h-12 px-4">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Phân phối" onClick={() => openDistribute(supply.id)}>
                          <PackageMinus className="h-4 w-4" />
                        </Button>
                        <Link href={`/admin/supplies/${supply.id}/transactions?name=${encodeURIComponent(supply.name)}&unit=${encodeURIComponent(formatUnit(supply.unit))}`}>
                          <Button size="icon" variant="ghost" aria-label="Lịch sử giao dịch">
                            <History className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setEditTarget(supply)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label="Xóa"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(supply)}
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo vật tư mới">
        <CreateSupplyForm categories={categories} onSubmit={handleCreate} onCancel={() => setCreateOpen(false)} loading={createMutation.isPending} />
      </Dialog>

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Cập nhật vật tư">
        {editTarget && (
          <EditSupplyForm
            initial={editTarget}
            categories={categories}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xóa vật tư">
        {deleteTarget && (
          <DeleteSupplyConfirm supply={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleteMutation.isPending} />
        )}
      </Dialog>

      <CategoryManagerDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} categories={categories} />

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} supplies={pickerSupplies} />

      <DistributeDialog
        open={distributeOpen}
        onClose={() => { setDistributeOpen(false); setDistributeSupplyId(null); }}
        supplies={pickerSupplies}
        preselectedSupplyId={distributeSupplyId}
      />
    </div>
  );
}
