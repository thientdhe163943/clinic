'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Image as ImageIcon, Pencil, Search, Stethoscope, Upload, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { StatCard } from '@/components/shared/stat-card';
import {
  useApproveDoctorSpecialtyUpdate,
  useDoctorSpecialtyProfiles,
  useRejectDoctorSpecialtyUpdate,
  useSpecialtyOptions,
  useUpdateDoctorSpecialtyProfile,
} from '@/hooks/use-doctor-specialties';
import { resolveAvatarUrl, uploadsApi } from '@/lib/api/endpoints/uploads';
import { useNotificationStore } from '@/stores/notification.store';
import type {
  DoctorSpecialtyProfile,
  ListDoctorSpecialtyProfilesQuery,
  UpdateDoctorSpecialtyRequest,
} from '@/types/doctor-specialties';

interface FormErrors {
  specialtyId?: string;
  degree?: string;
  yearsExperience?: string;
  biography?: string;
}

const PAGE_SIZE = 10;
const MAX_DEGREE_LENGTH = 100;
const MAX_BIOGRAPHY_LENGTH = 2000;

function formatDateTime(value: string | null) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function cleanOptional(value: string) {
  return value.trim() || undefined;
}

interface EditDoctorSpecialtyFormProps {
  doctor: DoctorSpecialtyProfile;
  specialties: { id: string; name: string }[];
  loading: boolean;
  onCancel: () => void;
  onSubmit: (data: UpdateDoctorSpecialtyRequest) => void;
}

function EditDoctorSpecialtyForm({
  doctor,
  specialties,
  loading,
  onCancel,
  onSubmit,
}: EditDoctorSpecialtyFormProps) {
  const [specialtyId, setSpecialtyId] = useState(doctor.specialtyId ?? '');
  const [degree, setDegree] = useState(doctor.degree ?? '');
  const [yearsExperience, setYearsExperience] = useState(doctor.yearsExperience?.toString() ?? '');
  const [biography, setBiography] = useState(doctor.biography ?? '');
  const [avatarUrl, setAvatarUrl] = useState(doctor.avatarUrl ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const pushToast = useNotificationStore((state) => state.push);

  useEffect(() => {
    setSpecialtyId(doctor.specialtyId ?? '');
    setDegree(doctor.degree ?? '');
    setYearsExperience(doctor.yearsExperience?.toString() ?? '');
    setBiography(doctor.biography ?? '');
    setAvatarUrl(doctor.avatarUrl ?? '');
    setErrors({});
  }, [doctor]);

  function validate() {
    const next: FormErrors = {};
    const trimmedSpecialtyId = specialtyId.trim();
    const trimmedDegree = degree.trim();
    const trimmedYearsExperience = yearsExperience.trim();
    const trimmedBiography = biography.trim();

    if (!trimmedSpecialtyId) {
      next.specialtyId = 'Vui lòng chọn chuyên khoa';
    }

    if (trimmedDegree.length > MAX_DEGREE_LENGTH) {
      next.degree = `Học vị tối đa ${MAX_DEGREE_LENGTH} ký tự`;
    }

    const years = Number(trimmedYearsExperience);
    if (trimmedYearsExperience && (!Number.isInteger(years) || years < 0 || years > 80)) {
      next.yearsExperience = 'Số năm kinh nghiệm phải là số nguyên từ 0 đến 80';
    }

    if (trimmedBiography.length > MAX_BIOGRAPHY_LENGTH) {
      next.biography = `Tiểu sử tối đa ${MAX_BIOGRAPHY_LENGTH} ký tự`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const { url } = await uploadsApi.uploadAvatar(file);
      setAvatarUrl(url);
    } catch (error) {
      pushToast({
        variant: 'error',
        title: 'Tải ảnh lên thất bại',
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) return;

    onSubmit({
      specialtyId: specialtyId.trim(),
      degree: cleanOptional(degree),
      yearsExperience: yearsExperience.trim() ? Number(yearsExperience.trim()) : undefined,
      biography: cleanOptional(biography),
      avatarUrl: cleanOptional(avatarUrl),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-md bg-muted p-3">
        <p className="text-sm font-semibold">{doctor.fullName}</p>
        <p className="text-xs text-muted-foreground">{doctor.email}</p>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Chuyên khoa <span className="text-destructive">*</span>
        </label>
        <Select value={specialtyId} onChange={(event) => setSpecialtyId(event.target.value)} required>
          <option value="">Chọn chuyên khoa</option>
          {specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.id}>
              {specialty.name}
            </option>
          ))}
        </Select>
        {errors.specialtyId && <p className="text-xs text-destructive">{errors.specialtyId}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Học vị / bằng cấp</label>
          <Input
            value={degree}
            onChange={(event) => setDegree(event.target.value)}
            placeholder="VD: Bác sĩ CKI"
            maxLength={MAX_DEGREE_LENGTH}
          />
          {errors.degree && <p className="text-xs text-destructive">{errors.degree}</p>}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Số năm kinh nghiệm</label>
          <Input
            type="number"
            min={0}
            max={80}
            step={1}
            value={yearsExperience}
            onChange={(event) => setYearsExperience(event.target.value)}
            placeholder="VD: 8"
          />
          {errors.yearsExperience && <p className="text-xs text-destructive">{errors.yearsExperience}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Ảnh đại diện</label>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted bg-cover bg-center text-muted-foreground"
            style={avatarUrl ? { backgroundImage: `url(${resolveAvatarUrl(avatarUrl)})` } : undefined}
          >
            {avatarUrl ? null : <ImageIcon className="h-5 w-5" />}
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60">
            <Upload className="h-4 w-4" />
            {uploadingAvatar ? 'Đang tải lên...' : 'Chọn ảnh từ máy'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={uploadingAvatar}
              onChange={handleAvatarFileChange}
            />
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Tiểu sử chuyên môn</label>
        <textarea
          value={biography}
          onChange={(event) => setBiography(event.target.value)}
          rows={5}
          placeholder="Kinh nghiệm, lĩnh vực chuyên sâu, chứng chỉ nổi bật..."
          maxLength={MAX_BIOGRAPHY_LENGTH}
          className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
        {errors.biography && <p className="text-xs text-destructive">{errors.biography}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-2">
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

export default function AdminDoctorSpecialtiesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState<ListDoctorSpecialtyProfilesQuery>({ page: 1, limit: PAGE_SIZE });
  const [editTarget, setEditTarget] = useState<DoctorSpecialtyProfile | null>(null);
  const [reviewTarget, setReviewTarget] = useState<DoctorSpecialtyProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data, isLoading, isError, error } = useDoctorSpecialtyProfiles(query);
  const { data: specialties = [] } = useSpecialtyOptions();
  const updateProfile = useUpdateDoctorSpecialtyProfile();
  const approveUpdate = useApproveDoctorSpecialtyUpdate();
  const rejectUpdate = useRejectDoctorSpecialtyUpdate();

  const doctors = data?.items ?? [];
  const meta = data?.meta;
  const summary = data?.summary;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      page: 1,
      search: searchInput.trim() || undefined,
    }));
  }

  function handleUpdate(updateData: UpdateDoctorSpecialtyRequest) {
    if (!editTarget) return;
    updateProfile.mutate(
      { userId: editTarget.userId, data: updateData },
      {
        onSuccess: () => setEditTarget(null),
      },
    );
  }

  return (
    <main>
      <PageHeader
        title="Chuyên khoa bác sĩ"
        description="Quản lý chuyên khoa và hồ sơ chuyên môn của toàn bộ bác sĩ"
      />

      <section className="grid gap-4 p-5 md:grid-cols-3">
        <StatCard icon={UserRound} label="Tổng bác sĩ" value={String(meta?.total ?? 0)} tone="blue" />
        <StatCard icon={Stethoscope} label="Đã gán chuyên khoa" value={String(summary?.assigned ?? 0)} tone="teal" />
        <StatCard icon={UserRound} label="Đang hoạt động" value={String(summary?.active ?? 0)} tone="amber" />
      </section>

      <section className="space-y-4 px-5 pb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form className="flex w-full gap-2 md:max-w-xl" onSubmit={handleSearch}>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm bác sĩ, email, chuyên khoa..."
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                maxLength={100}
              />
            </div>
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
              Tìm
            </Button>
          </form>
          <Badge variant="muted">{meta ? `${meta.total} bác sĩ` : '...'}</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">STT</th>
                  <th className="h-10 px-4 font-semibold">Bác sĩ</th>
                  <th className="h-10 px-4 font-semibold">Chuyên khoa</th>
                  <th className="h-10 px-4 font-semibold">Học vị</th>
                  <th className="h-10 px-4 font-semibold">Kinh nghiệm</th>
                  <th className="h-10 px-4 font-semibold">Trạng thái</th>
                  <th className="h-10 px-4 font-semibold">Cập nhật</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="h-32 text-center text-muted-foreground">
                      Đang tải...
                    </td>
                  </tr>
                )}
                {isError && (
                  <tr>
                    <td colSpan={8} className="h-32 text-center text-destructive">
                      Lỗi tải dữ liệu: {error?.message ?? 'Vui lòng thử lại'}
                    </td>
                  </tr>
                )}
                {!isLoading && !isError && doctors.length === 0 && (
                  <tr>
                    <td colSpan={8} className="h-32 text-center text-muted-foreground">
                      Không có dữ liệu
                    </td>
                  </tr>
                )}
                {doctors.map((doctor, index) => {
                  const rowNumber = ((meta?.page ?? query.page ?? 1) - 1) * (meta?.limit ?? PAGE_SIZE) + index + 1;
                  return (
                    <tr key={doctor.userId} className="border-t border-border bg-white transition-colors hover:bg-muted/30">
                      <td className="h-14 px-4 text-muted-foreground">{rowNumber}</td>
                      <td className="h-14 px-4">
                        <p className="font-medium">{doctor.fullName}</p>
                        <p className="text-xs text-muted-foreground">{doctor.email}</p>
                      </td>
                      <td className="h-14 px-4">
                        <Badge variant={doctor.specialtyId ? 'default' : 'warning'}>
                          {doctor.specialtyName ?? 'Chưa gán'}
                        </Badge>
                      </td>
                      <td className="h-14 px-4 text-muted-foreground">{doctor.degree ?? '-'}</td>
                      <td className="h-14 px-4 text-muted-foreground">
                        {doctor.yearsExperience != null ? `${doctor.yearsExperience} năm` : '-'}
                      </td>
                      <td className="h-14 px-4">
                        <Badge variant={doctor.pendingUpdate?.status === 'PENDING_APPROVAL' ? 'warning' : doctor.isActive ? 'success' : 'danger'}>
                          {doctor.pendingUpdate?.status === 'PENDING_APPROVAL'
                            ? 'Chờ duyệt'
                            : doctor.isActive
                              ? 'Hoạt động'
                              : 'Vô hiệu'}
                        </Badge>
                      </td>
                      <td className="h-14 px-4 text-muted-foreground">{formatDateTime(doctor.updatedAt)}</td>
                      <td className="h-14 px-4">
                        <div className="flex justify-end gap-2">
                          {doctor.pendingUpdate?.status === 'PENDING_APPROVAL' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setRejectReason('');
                                setReviewTarget(doctor);
                              }}
                            >
                              Xem đề xuất
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => setEditTarget(doctor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {meta && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
          />
        )}
      </section>

      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Cập nhật chuyên khoa bác sĩ">
        {editTarget && (
          <EditDoctorSpecialtyForm
            doctor={editTarget}
            specialties={specialties}
            loading={updateProfile.isPending}
            onCancel={() => setEditTarget(null)}
            onSubmit={handleUpdate}
          />
        )}
      </Dialog>

      <Dialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title="Đề xuất cập nhật chuyên khoa"
        description={reviewTarget ? `${reviewTarget.fullName} (${reviewTarget.email})` : undefined}
      >
        {reviewTarget?.pendingUpdate && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Chuyên khoa đề xuất</dt>
              <dd className="font-medium">{reviewTarget.pendingUpdate.specialtyName ?? '-'}</dd>
              <dt className="text-muted-foreground">Học vị đề xuất</dt>
              <dd className="font-medium">{reviewTarget.pendingUpdate.degree ?? '-'}</dd>
              <dt className="text-muted-foreground">Kinh nghiệm đề xuất</dt>
              <dd className="font-medium">
                {reviewTarget.pendingUpdate.yearsExperience != null
                  ? `${reviewTarget.pendingUpdate.yearsExperience} năm`
                  : '-'}
              </dd>
              <dt className="text-muted-foreground">Gửi lúc</dt>
              <dd className="font-medium">{formatDateTime(reviewTarget.pendingUpdate.submittedAt)}</dd>
            </dl>
            <div>
              <p className="text-xs text-muted-foreground">Tiểu sử chuyên môn đề xuất</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{reviewTarget.pendingUpdate.biography ?? '-'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Lý do từ chối (nếu từ chối)</label>
              <textarea
                className="min-h-20 w-full rounded-md border border-input p-3 text-sm"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do để bác sĩ biết cần chỉnh sửa gì..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="danger"
                disabled={approveUpdate.isPending || rejectUpdate.isPending}
                onClick={() =>
                  rejectUpdate.mutate(
                    { userId: reviewTarget.userId, reason: rejectReason.trim() || undefined },
                    { onSuccess: () => setReviewTarget(null) },
                  )
                }
              >
                Từ chối
              </Button>
              <Button
                disabled={approveUpdate.isPending || rejectUpdate.isPending}
                onClick={() =>
                  approveUpdate.mutate(reviewTarget.userId, { onSuccess: () => setReviewTarget(null) })
                }
              >
                Duyệt
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
