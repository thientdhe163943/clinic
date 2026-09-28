'use client';

import { useMemo, useState } from 'react';
import { Edit3, Eye, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { PatientForm } from '@/components/shared/patient-form';
import { PatientDetailCard } from '@/components/shared/patient-detail-card';
import { useCreatePatient, usePatients, useUpdatePatient } from '@/hooks/use-patients';
import type { CreatePatientRequest, Gender, PatientProfile, UpdatePatientRequest } from '@/types/patients';

const EMPTY_FORM: CreatePatientRequest = {
  fullName: '',
  email: '',
  dateOfBirth: '',
  gender: 'MALE',
  phone: '',
  idCard: '',
  address: '',
  note: '',
  notificationConsent: false,
};

// Fixed system default set by CreatePatientUseCase for every walk-in
// account (see DEFAULT_PATIENT_PASSWORD in clinic_system's
// password-policy.vo.ts) — surfaced here so the credentials dialog below can
// tell the admin what to hand off; not a secret specific to this account.
const DEFAULT_PATIENT_PASSWORD = 'Patient@123';

const genderLabel: Record<Gender, string> = { MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' };

function toDateInput(v?: string | null) {
  return v ? v.slice(0, 10) : '';
}

export default function AdminPatientsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PatientProfile | null>(null);
  const [detailTarget, setDetailTarget] = useState<PatientProfile | null>(null);
  // Set right after a successful create so the credentials dialog can show
  // the login identifiers/password — the default password is only shown
  // this once, so this must not be silently dropped (see handleCreate).
  const [createdPatient, setCreatedPatient] = useState<PatientProfile | null>(null);

  const query = useMemo(() => ({ page, limit: 10, search: search || undefined }), [page, search]);
  const { data, isLoading, error } = usePatients(query);
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();

  const patients = data?.items ?? [];

  async function handleCreate(payload: CreatePatientRequest) {
    const result = await createPatient.mutateAsync(payload);
    setCreateOpen(false);
    if (result.data) setCreatedPatient(result.data);
  }

  async function handleUpdate(payload: UpdatePatientRequest) {
    if (!editTarget) return;
    await updatePatient.mutateAsync({ id: editTarget.id, input: payload });
    setEditTarget(null);
  }

  function toFormInitial(p: PatientProfile): CreatePatientRequest {
    return {
      fullName: p.fullName,
      email: p.email ?? '',
      dateOfBirth: toDateInput(p.dateOfBirth),
      gender: p.gender,
      phone: p.phone,
      idCard: p.idCard ?? '',
      address: p.address ?? '',
      note: p.note ?? '',
      notificationConsent: p.notificationConsent,
    };
  }

  return (
    <main className="min-h-full bg-background">
      <PageHeader
        title="Hồ sơ bệnh nhân"
        description="Tạo, tra cứu và cập nhật thông tin hành chính của bệnh nhân"
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Tạo hồ sơ
          </Button>
        }
      />

      <section className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <form
            className="flex w-full gap-2 md:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm theo mã BN, họ tên, email hoặc SĐT"
              />
            </div>
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" /> Tìm
            </Button>
          </form>
          <Badge variant="muted">{data?.meta.total ?? patients.length} hồ sơ</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="h-10 px-4 font-semibold">Mã BN</th>
                  <th className="h-10 px-4 font-semibold">Họ tên</th>
                  <th className="h-10 px-4 font-semibold">Email</th>
                  <th className="h-10 px-4 font-semibold">Số điện thoại</th>
                  <th className="h-10 px-4 font-semibold">Giới tính</th>
                  <th className="h-10 px-4 font-semibold">Nhắc lịch</th>
                  <th className="h-10 px-4 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-muted-foreground">
                      Đang tải hồ sơ...
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-destructive">
                      {error.message}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && patients.length === 0 && (
                  <tr>
                    <td colSpan={7} className="h-14 px-4 text-muted-foreground">
                      Chưa có hồ sơ phù hợp.
                    </td>
                  </tr>
                )}
                {patients.map((p) => (
                  <tr key={p.id} className="border-t border-border bg-white hover:bg-muted/30 transition-colors">
                    <td className="h-12 px-4 font-mono text-xs font-medium">{p.patientCode}</td>
                    <td className="h-12 px-4 font-medium">{p.fullName}</td>
                    <td className="h-12 px-4 text-muted-foreground">{p.email ?? '—'}</td>
                    <td className="h-12 px-4">{p.phone}</td>
                    <td className="h-12 px-4">{genderLabel[p.gender]}</td>
                    <td className="h-12 px-4">
                      <Badge variant={p.notificationConsent ? 'success' : 'muted'}>
                        {p.notificationConsent ? 'Có' : 'Không'}
                      </Badge>
                    </td>
                    <td className="h-12 px-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailTarget(p)}>
                          <Eye className="h-4 w-4" /> Chi tiết
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditTarget(p)}>
                          <Edit3 className="h-4 w-4" /> Sửa
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {data?.meta && (
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onPageChange={setPage} />
        )}
      </section>

      {/* Create Modal */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo hồ sơ bệnh nhân mới">
        <PatientForm
          initial={EMPTY_FORM}
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          loading={createPatient.isPending}
          submitLabel="Tạo hồ sơ"
          mode="create"
        />
      </Dialog>

      {/* Credentials dialog — shown once right after a successful create;
          the default password isn't retrievable afterwards. */}
      <Dialog
        open={Boolean(createdPatient)}
        onClose={() => setCreatedPatient(null)}
        title="Tạo hồ sơ thành công"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Hệ thống đã tạo tài khoản đăng nhập cho bệnh nhân. Vui lòng đọc thông tin dưới đây cho bệnh nhân trước khi
            đóng — mật khẩu mặc định chỉ hiển thị đúng 1 lần ở đây.
          </p>
          <div className="space-y-2 rounded-md border border-border bg-muted p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Mã bệnh nhân</span>
              <span className="font-medium">{createdPatient?.patientCode}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Số điện thoại</span>
              <span className="font-medium">{createdPatient?.phone}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{createdPatient?.email ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">CCCD/CMND</span>
              <span className="font-medium">{createdPatient?.idCard}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Mật khẩu mặc định</span>
              <span className="font-mono font-medium">{DEFAULT_PATIENT_PASSWORD}</span>
            </div>
          </div>
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Bệnh nhân có thể đăng nhập bằng SĐT, Email, hoặc CCCD/CMND ở trên + mật khẩu mặc định, và sẽ được yêu cầu
            đổi mật khẩu ngay khi đăng nhập lần đầu.
          </p>
          <Button className="w-full" onClick={() => setCreatedPatient(null)}>
            Đã hiểu
          </Button>
        </div>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} title="Cập nhật hồ sơ bệnh nhân">
        {editTarget && (
          <PatientForm
            key={editTarget.id}
            initial={toFormInitial(editTarget)}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={updatePatient.isPending}
            submitLabel="Lưu thay đổi"
            patientCode={editTarget.patientCode}
          />
        )}
      </Dialog>

      {/* Detail Modal */}
      <Dialog
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget ? `Hồ sơ: ${detailTarget.fullName}` : ''}
      >
        {detailTarget && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <PatientDetailCard patient={detailTarget} />
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => setDetailTarget(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
