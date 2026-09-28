'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { useCreateService, useDeleteService, useServiceList, useUpdateService } from '@/hooks/use-services';
import { useSpecialtyOptions } from '@/hooks/use-doctor-specialties';
import type { SpecialtyOption } from '@/types/doctor-specialties';
import type { ClsServiceCategory, CreateServiceRequest, Service, ServiceType, UpdateServiceRequest } from '@/types/services';

const CLS_CATEGORY_LABEL: Record<ClsServiceCategory, string> = {
  LAB: 'Xét nghiệm',
  XRAY: 'X-quang',
  ULTRASOUND: 'Siêu âm',
  ECG: 'Chụp điện tim',
};

const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  EXAMINATION: 'Khám',
  CLS: 'CLS',
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

// ─── Create Form ──────────────────────────────────────────────────────────────

interface CreateFormErrors {
  name?: string;
  specialtyId?: string;
  price?: string;
  clsCategory?: string;
}

interface CreateFormProps {
  specialties: SpecialtyOption[];
  onSubmit: (data: CreateServiceRequest) => void;
  onCancel: () => void;
  loading: boolean;
}

function CreateForm({ specialties, onSubmit, onCancel, loading }: CreateFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ServiceType>('EXAMINATION');
  const [clsCategory, setClsCategory] = useState<ClsServiceCategory | ''>('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<CreateFormErrors>({});

  const validate = (): boolean => {
    const next: CreateFormErrors = {};
    if (!name.trim()) {
      next.name = 'Tên dịch vụ không được để trống';
    } else if (name.trim().length > 50) {
      next.name = 'Tên dịch vụ tối đa 50 ký tự';
    }
    const p = Number(price);
    if (!price || isNaN(p) || p <= 0) {
      next.price = 'Giá phải là số dương';
    }
    if (type === 'CLS' && !clsCategory) {
      next.clsCategory = 'Vui lòng chọn nhóm CLS';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      type,
      clsCategory: type === 'CLS' && clsCategory ? clsCategory : undefined,
      specialtyId: specialtyId || undefined,
      price: Number(price),
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mã dịch vụ</label>
        <Input value="Tự động sinh" disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Tên dịch vụ <span className="text-destructive">*</span>
          <span className="ml-1 text-xs text-muted-foreground">({name.trim().length}/50)</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Khám tổng quát"
          maxLength={50}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Loại dịch vụ <span className="text-destructive">*</span></label>
          <Select value={type} onChange={(e) => { setType(e.target.value as ServiceType); setClsCategory(''); }}>
            <option value="EXAMINATION">Khám bệnh</option>
            <option value="CLS">CLS (Cận lâm sàng)</option>
          </Select>
        </div>
        {type === 'CLS' && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Nhóm CLS <span className="text-destructive">*</span></label>
            <Select value={clsCategory} onChange={(e) => setClsCategory(e.target.value as ClsServiceCategory)}>
              <option value="">-- Chọn nhóm --</option>
              <option value="LAB">Xét nghiệm (LAB)</option>
              <option value="XRAY">X-quang (XRAY)</option>
              <option value="ULTRASOUND">Siêu âm (ULTRASOUND)</option>
              <option value="ECG">Chụp điện tim (ECG)</option>
            </Select>
            {errors.clsCategory && <p className="text-xs text-destructive">{errors.clsCategory}</p>}
          </div>
        )}
      </div>

      {type === 'EXAMINATION' && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Chuyên khoa</label>
          <Select value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
            <option value="">Chọn chuyên khoa</option>
            {specialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Giá (VNĐ) <span className="text-destructive">*</span></label>
        <Input
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="VD: 150000"
        />
        {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mô tả</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn về dịch vụ (tùy chọn)"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>Hủy</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Tạo dịch vụ'}
        </Button>
      </div>
    </form>
  );
}

// ─── Edit Form ────────────────────────────────────────────────────────────────

interface EditFormErrors {
  name?: string;
  specialtyId?: string;
  price?: string;
  clsCategory?: string;
}

interface EditFormProps {
  initial: Service;
  specialties: SpecialtyOption[];
  onSubmit: (data: UpdateServiceRequest) => void;
  onCancel: () => void;
  loading: boolean;
}

function EditForm({ initial, specialties, onSubmit, onCancel, loading }: EditFormProps) {
  const [name, setName] = useState(initial.name);
  const [clsCategory, setClsCategory] = useState<ClsServiceCategory | ''>(initial.clsCategory ?? '');
  const [specialtyId, setSpecialtyId] = useState(initial.specialtyId ?? '');
  const [price, setPrice] = useState(initial.price.toString());
  const [description, setDescription] = useState(initial.description ?? '');
  const [isActive, setIsActive] = useState(initial.isActive);
  const [errors, setErrors] = useState<EditFormErrors>({});

  const validate = (): boolean => {
    const next: EditFormErrors = {};
    if (!name.trim()) {
      next.name = 'Tên dịch vụ không được để trống';
    } else if (name.trim().length > 50) {
      next.name = 'Tên dịch vụ tối đa 50 ký tự';
    }
    const p = Number(price);
    if (!price || isNaN(p) || p <= 0) {
      next.price = 'Giá phải là số dương';
    }
    if (initial.type === 'CLS' && !clsCategory) {
      next.clsCategory = 'Vui lòng chọn nhóm CLS';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      name: name.trim(),
      clsCategory: initial.type === 'CLS' ? (clsCategory || undefined) : undefined,
      specialtyId: initial.type === 'CLS' ? null : (specialtyId || undefined),
      price: Number(price),
      description: description.trim() || undefined,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mã dịch vụ</label>
        <Input
          value={initial.serviceCode ?? '—'}
          disabled
          className="bg-muted text-muted-foreground cursor-not-allowed font-mono"
        />
        <p className="text-xs text-muted-foreground">Mã dịch vụ không thể thay đổi</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Tên dịch vụ <span className="text-destructive">*</span>
          <span className="ml-1 text-xs text-muted-foreground">({name.trim().length}/50)</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: Khám tổng quát"
          maxLength={50}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Loại dịch vụ</label>
          <Input
            value={SERVICE_TYPE_LABEL[initial.type]}
            disabled
            className="bg-muted text-muted-foreground cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">Không thể thay đổi loại dịch vụ</p>
        </div>
        {initial.type === 'CLS' && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Nhóm CLS <span className="text-destructive">*</span></label>
            <Select value={clsCategory} onChange={(e) => setClsCategory(e.target.value as ClsServiceCategory)}>
              <option value="">-- Chọn nhóm --</option>
              <option value="LAB">Xét nghiệm (LAB)</option>
              <option value="XRAY">X-quang (XRAY)</option>
              <option value="ULTRASOUND">Siêu âm (ULTRASOUND)</option>
              <option value="ECG">Chụp điện tim (ECG)</option>
            </Select>
            {errors.clsCategory && <p className="text-xs text-destructive">{errors.clsCategory}</p>}
          </div>
        )}
      </div>

      {initial.type === 'EXAMINATION' && (
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Chuyên khoa</label>
          <Select value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
            <option value="">Chọn chuyên khoa</option>
            {specialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>{specialty.name}</option>
            ))}
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Giá (VNĐ) <span className="text-destructive">*</span></label>
        <Input
          type="number"
          min={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Mô tả</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả ngắn về dịch vụ (tùy chọn)"
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Trạng thái <span className="text-destructive">*</span></label>
        <select
          value={isActive ? 'active' : 'inactive'}
          onChange={(e) => setIsActive(e.target.value === 'active')}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="active">Hoạt động</option>
          <option value="inactive">Không hoạt động</option>
        </select>
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
  service: Service;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirm({ service, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">
        Bạn có chắc muốn xóa dịch vụ{' '}
        <span className="font-semibold">{service.name}</span>? Hành động này không thể hoàn tác.
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

export default function AdminServicesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const { data, isLoading, isError, error } = useServiceList({ search: search || undefined, page, limit: 10 });
  const { data: specialties = [] } = useSpecialtyOptions();
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const deleteMutation = useDeleteService();

  // If the current page becomes out of range (e.g. after deleting the last
  // item on the last page), clamp back to the new last page instead of
  // showing an empty table with no visible pagination controls to escape it
  // (Pagination hides itself once totalPages <= 1).
  useEffect(() => {
    if (data?.meta && data.meta.totalPages > 0 && data.meta.page > data.meta.totalPages) {
      setPage(data.meta.totalPages);
    }
  }, [data?.meta]);

  const handleCreate = (req: CreateServiceRequest) => {
    createMutation.mutate(req, { onSuccess: () => setCreateOpen(false) });
  };

  const handleUpdate = (req: UpdateServiceRequest) => {
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
        title="Quản lý dịch vụ"
        description="Danh mục dịch vụ khám và giá"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Tạo dịch vụ
          </Button>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Tìm kiếm theo tên hoặc mã dịch vụ..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <Badge variant="muted">{total} dịch vụ</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">STT</th>
                  <th className="h-10 px-4 font-semibold">Tên dịch vụ</th>
                  <th className="h-10 px-4 font-semibold">Loại</th>
                  <th className="h-10 px-4 font-semibold">Chuyên khoa</th>
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
                {items.map((svc, idx) => (
                  <tr key={svc.id} className="border-t border-border bg-white hover:bg-muted/30 transition-colors">
                    <td className="h-12 px-4 text-muted-foreground tabular-nums">
                      {(page - 1) * 10 + idx + 1}
                    </td>
                    <td className="h-12 px-4 font-medium">{svc.name}</td>
                    <td className="h-12 px-4">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={svc.type === 'CLS' ? 'default' : 'muted'}>
                          {SERVICE_TYPE_LABEL[svc.type]}
                        </Badge>
                        {svc.type === 'CLS' && svc.clsCategory && (
                          <span className="text-xs text-muted-foreground">{CLS_CATEGORY_LABEL[svc.clsCategory]}</span>
                        )}
                        {svc.type === 'CLS' && !svc.clsCategory && (
                          <span className="text-xs text-amber-600">Chưa gắn nhóm</span>
                        )}
                      </div>
                    </td>
                    <td className="h-12 px-4 text-muted-foreground">{svc.specialtyName ?? '—'}</td>
                    <td className="h-12 px-4 tabular-nums">{formatPrice(svc.price)}</td>
                    <td className="h-12 px-4">
                      <Badge variant={svc.isActive ? 'success' : 'danger'}>
                        {svc.isActive ? 'Hoạt động' : 'Không hoạt động'}
                      </Badge>
                    </td>
                    <td className="h-12 px-4">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setEditTarget(svc)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost" aria-label="Xóa"
                          onClick={() => setDeleteTarget(svc)}
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo dịch vụ mới">
        <CreateForm
          specialties={specialties}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          loading={createMutation.isPending}
        />
      </Dialog>

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Cập nhật dịch vụ">
        {editTarget && (
          <EditForm
            initial={editTarget}
            specialties={specialties}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xóa dịch vụ">
        {deleteTarget && (
          <DeleteConfirm
            service={deleteTarget}
            onConfirm={handleDelete}
            onCancel={() => setDeleteTarget(null)}
            loading={deleteMutation.isPending}
          />
        )}
      </Dialog>
    </div>
  );
}
