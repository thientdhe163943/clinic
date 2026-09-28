'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Award, BriefcaseMedical, Image as ImageIcon, Save, Stethoscope, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { useDoctorSpecialtyEvents } from '@/hooks/use-doctor-specialty-events';
import {
  useMyDoctorSpecialty,
  useSpecialtyOptions,
  useUpdateMyDoctorSpecialty,
} from '@/hooks/use-doctor-specialties';
import { resolveAvatarUrl, uploadsApi } from '@/lib/api/endpoints/uploads';
import { useNotificationStore } from '@/stores/notification.store';
import type { UpdateDoctorSpecialtyRequest } from '@/types/doctor-specialties';

interface FormErrors {
  specialtyId?: string;
  subspecialty?: string;
  degree?: string;
  certification?: string;
  yearsExperience?: string;
  biography?: string;
}

const MAX_SUBSPECIALTY_LENGTH = 150;
const MAX_DEGREE_LENGTH = 100;
const MAX_CERTIFICATION_LENGTH = 2000;
const MAX_BIOGRAPHY_LENGTH = 2000;

function formatDateTime(value: string | null) {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function cleanNullable(value: string) {
  return value.trim() || null;
}

// Trang "Chuyên khoa bác sĩ" (UC 2.10.1 / 2.10.2) — nơi bác sĩ tự xem và sửa
// hồ sơ chuyên khoa của mình (chuyên khoa, bằng cấp, kinh nghiệm, ảnh đại
// diện, chứng chỉ...). Nút "Lưu hồ sơ" ở cuối form là điểm bắt đầu của luồng
// UC 2.10.1 — xem hàm handleSubmit bên dưới.
export default function DoctorSpecialtyPage() {
  // Lắng nghe thông báo realtime: khi Admin duyệt/từ chối yêu cầu cập nhật
  // của bác sĩ này, trang sẽ tự động tải lại dữ liệu mới nhất mà không cần
  // bác sĩ phải bấm F5 (xem chi tiết cơ chế trong use-doctor-specialty-events.ts).
  useDoctorSpecialtyEvents();

  // Gọi API GET /doctor-specialties/me ngay khi trang mở lên — đây là luồng
  // UC 2.10.2 "Xem hồ sơ chuyên khoa" (bác sĩ tự xem của mình).
  const { data: profile, isLoading: profileLoading } = useMyDoctorSpecialty();
  // Tải danh sách chuyên khoa của phòng khám để đổ vào ô "Chọn chuyên khoa".
  const { data: specialties = [], isLoading: specialtiesLoading } = useSpecialtyOptions();
  // "Cây súng" để bắn API cập nhật hồ sơ — updateProfile.mutate(data) ở
  // handleSubmit bên dưới chính là nơi kích hoạt luồng UC 2.10.1.
  const updateProfile = useUpdateMyDoctorSpecialty();

  const [specialtyId, setSpecialtyId] = useState('');
  const [subspecialty, setSubspecialty] = useState('');
  const [degree, setDegree] = useState('');
  const [certification, setCertification] = useState('');
  const [certificationFileUrls, setCertificationFileUrls] = useState<string[]>([]);
  const [yearsExperience, setYearsExperience] = useState('');
  const [biography, setBiography] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const pushToast = useNotificationStore((state) => state.push);

  // Mỗi khi `profile` (dữ liệu lấy từ GET /doctor-specialties/me) thay đổi —
  // ví dụ vừa tải trang xong, hoặc vừa lưu thành công — tự động đổ dữ liệu
  // vào các ô nhập trên form.
  useEffect(() => {
    if (!profile) return;
    // Ưu tiên hiển thị bản "đang chờ duyệt" (pendingUpdate) nếu có, thay vì
    // hồ sơ chính thức đã duyệt (profile). Lý do: nếu không làm vậy, ngay
    // sau khi bác sĩ bấm "Lưu hồ sơ" thành công, form sẽ tự động hiện lại
    // DỮ LIỆU CŨ (vì dữ liệu mới chỉ thật sự có hiệu lực khi Admin duyệt) —
    // khiến bác sĩ tưởng nhầm là vừa lưu bị mất, dữ liệu không được ghi nhận.
    const source = profile.pendingUpdate ?? profile;
    setSpecialtyId(source.specialtyId ?? '');
    setSubspecialty(source.subspecialty ?? '');
    setDegree(source.degree ?? '');
    setCertification(source.certification ?? '');
    setCertificationFileUrls(
      profile.pendingUpdate
        ? profile.pendingUpdate.certificationFileUrls
        : (profile.certificationFiles?.map((file) => file.fileUrl) ?? []),
    );
    setYearsExperience(source.yearsExperience?.toString() ?? '');
    setBiography(source.biography ?? '');
    setAvatarUrl(source.avatarUrl ?? '');
    setErrors({});
  }, [profile]);

  const hasProfile = Boolean(profile?.id);
  const pendingUpdate = profile?.pendingUpdate;

  function validate() {
    const next: FormErrors = {};
    const trimmedSpecialtyId = specialtyId.trim();
    const trimmedSubspecialty = subspecialty.trim();
    const trimmedDegree = degree.trim();
    const trimmedCertification = certification.trim();
    const trimmedYearsExperience = yearsExperience.trim();
    const trimmedBiography = biography.trim();

    if (!trimmedSpecialtyId) {
      next.specialtyId = 'Vui lòng chọn chuyên khoa';
    }

    if (trimmedSubspecialty.length > MAX_SUBSPECIALTY_LENGTH) {
      next.subspecialty = `Chuyên khoa sâu tối đa ${MAX_SUBSPECIALTY_LENGTH} ký tự`;
    }

    if (trimmedDegree.length > MAX_DEGREE_LENGTH) {
      next.degree = `Học vị tối đa ${MAX_DEGREE_LENGTH} ký tự`;
    }

    if (trimmedCertification.length > MAX_CERTIFICATION_LENGTH) {
      next.certification = `Thông tin chứng chỉ tối đa ${MAX_CERTIFICATION_LENGTH} ký tự`;
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

  // ĐIỂM BẮT ĐẦU CỦA UC 2.10.1 — được gọi khi bác sĩ bấm nút "Lưu hồ sơ"
  // (submit form) ở cuối trang.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // Chặn hành vi mặc định của trình duyệt (load lại trang khi submit form).
    if (!validate()) return; // Kiểm tra dữ liệu nhập hợp lệ ngay trên trình duyệt trước — sai thì dừng, không gọi API.

    // Gom toàn bộ dữ liệu từ các ô nhập trên form thành 1 object đúng định
    // dạng mà backend yêu cầu (chuỗi rỗng -> chuyển thành null nhờ hàm
    // cleanNullable, vì backend phân biệt "không có giá trị" khác với "chuỗi rỗng").
    const data: UpdateDoctorSpecialtyRequest = {
      specialtyId: specialtyId.trim(),
      subspecialty: cleanNullable(subspecialty),
      degree: cleanNullable(degree),
      certification: cleanNullable(certification),
      certificationFileUrls,
      yearsExperience: yearsExperience.trim() ? Number(yearsExperience.trim()) : null,
      biography: cleanNullable(biography),
      avatarUrl: cleanNullable(avatarUrl),
    };

    // Đây là dòng THỰC SỰ gửi request lên backend (PUT /doctor-specialties/me)
    // — xem hook useUpdateMyDoctorSpecialty() trong use-doctor-specialties.ts
    // để biết chuyện gì xảy ra tiếp theo.
    updateProfile.mutate(data);
  }

  return (
    <main>
      <PageHeader
        title="Chuyên khoa bác sĩ"
        description="Hồ sơ chuyên môn dùng cho thông tin giới thiệu bác sĩ"
      />

      <section className="grid gap-4 p-5 md:grid-cols-3">
        <StatCard icon={Stethoscope} label="Chuyên khoa" value={profile?.specialtyName ?? 'Chưa có'} tone="blue" />
        <StatCard icon={Award} label="Học vị" value={profile?.degree ?? 'Chưa có'} tone="teal" />
        <StatCard
          icon={BriefcaseMedical}
          label="Kinh nghiệm"
          value={profile?.yearsExperience != null ? `${profile.yearsExperience} năm` : 'Chưa có'}
          tone="amber"
        />
      </section>

      <section className="grid gap-5 px-5 pb-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-muted bg-cover bg-center text-muted-foreground"
                style={
                  profile?.avatarUrl ? { backgroundImage: `url(${resolveAvatarUrl(profile.avatarUrl)})` } : undefined
                }
                aria-label={profile?.avatarUrl ? profile.fullName : undefined}
                role={profile?.avatarUrl ? 'img' : undefined}
              >
                {profile?.avatarUrl ? null : <ImageIcon className="h-6 w-6" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{profile?.fullName ?? 'Đang tải...'}</p>
                <p className="truncate text-sm text-muted-foreground">{profile?.email ?? '-'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={hasProfile ? 'success' : 'warning'}>
                    {hasProfile ? 'Đã có hồ sơ' : 'Chưa có hồ sơ'}
                  </Badge>
                  {pendingUpdate?.status === 'PENDING_APPROVAL' && (
                    <Badge variant="warning">Đang chờ duyệt</Badge>
                  )}
                  {pendingUpdate?.status === 'REJECTED' && <Badge variant="danger">Bị từ chối</Badge>}
                  <Badge variant="muted">{formatDateTime(profile?.updatedAt ?? null)}</Badge>
                </div>
              </div>
            </div>
            {pendingUpdate?.status === 'PENDING_APPROVAL' && (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Thông tin bên dưới là nội dung bạn vừa gửi, đang chờ admin duyệt. Hồ sơ hiển thị công khai
                vẫn là thông tin đã được duyệt trước đó cho tới khi admin xử lý.
              </p>
            )}
            {pendingUpdate?.status === 'REJECTED' && pendingUpdate.rejectionReason && (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                Yêu cầu cập nhật đã bị từ chối: {pendingUpdate.rejectionReason}
              </p>
            )}
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Chuyên khoa hiện tại</dt>
                <dd className="font-medium">{profile?.specialtyName ?? 'Chưa chọn'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Mô tả chuyên khoa</dt>
                <dd className="text-muted-foreground">{profile?.specialtyDescription ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Số điện thoại</dt>
                <dd className="font-medium">{profile?.phone ?? '-'}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-foreground">
                  Chuyên khoa <span className="text-destructive">*</span>
                </label>
                <Select
                  value={specialtyId}
                  onChange={(event) => setSpecialtyId(event.target.value)}
                  disabled={profileLoading || specialtiesLoading}
                  required
                >
                  <option value="">Chọn chuyên khoa</option>
                  {specialties.map((specialty) => (
                    <option key={specialty.id} value={specialty.id}>
                      {specialty.name}
                    </option>
                  ))}
                </Select>
                {errors.specialtyId && <p className="text-xs text-destructive">{errors.specialtyId}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Chuyên khoa sâu</label>
                <Input
                  value={subspecialty}
                  onChange={(event) => setSubspecialty(event.target.value)}
                  placeholder="VD: Tim mạch can thiệp"
                  maxLength={MAX_SUBSPECIALTY_LENGTH}
                />
                {errors.subspecialty && <p className="text-xs text-destructive">{errors.subspecialty}</p>}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Học vị / bằng cấp</label>
                <Input
                  value={degree}
                  onChange={(event) => setDegree(event.target.value)}
                  placeholder="VD: Thạc sĩ, Bác sĩ CKI"
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

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Tên chứng chỉ chuyên môn</label>
                <textarea
                  value={certification}
                  onChange={(event) => setCertification(event.target.value)}
                  rows={4}
                  placeholder="Liệt kê tên chứng chỉ, mỗi chứng chỉ một dòng..."
                  maxLength={MAX_CERTIFICATION_LENGTH}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
                {errors.certification && <p className="text-xs text-destructive">{errors.certification}</p>}
              </div>

              <div className="space-y-1 md:col-span-2">
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

              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-foreground">Tiểu sử chuyên môn</label>
                <textarea
                  value={biography}
                  onChange={(event) => setBiography(event.target.value)}
                  rows={8}
                  placeholder="Kinh nghiệm, hướng điều trị, lĩnh vực chuyên sâu..."
                  maxLength={MAX_BIOGRAPHY_LENGTH}
                  className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
                />
                {errors.biography && <p className="text-xs text-destructive">{errors.biography}</p>}
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={profileLoading || updateProfile.isPending}>
                <Save className="h-4 w-4" />
                {updateProfile.isPending ? 'Đang lưu...' : 'Lưu hồ sơ'}
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </main>
  );
}
