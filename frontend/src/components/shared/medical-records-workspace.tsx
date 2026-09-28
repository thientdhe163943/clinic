'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Activity, ClipboardList, Pill, Save, Search, ShieldAlert, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { Pagination } from '@/components/shared/pagination';
import { useAuth } from '@/hooks/use-auth';
import { useMedicalRecord, useMedicalRecords, useUpdateMedicalRecord } from '@/hooks/use-medical-records';
import { resolveVisitDisplayStatus } from '@/lib/utils/visit-status';
import { useNotificationStore } from '@/stores/notification.store';
import type {
  AllergySeverity,
  MedicalRecordAllergy,
  MedicalRecordVisit,
  UpdateMedicalRecordRequest,
} from '@/types/medical-records';
import type { VisitStatus } from '@/types/visits';

const EMPTY_FORM: UpdateMedicalRecordRequest = {
  medicalHistory: '',
  clinicalNote: '',
  diagnosisSummary: '',
  treatmentSummary: '',
  followUpNote: '',
  allergies: [],
};

const severityLabel: Record<AllergySeverity, string> = {
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  SEVERE: 'Nặng',
};

const severityVariant: Record<AllergySeverity, 'success' | 'warning' | 'danger'> = {
  MILD: 'success',
  MODERATE: 'warning',
  SEVERE: 'danger',
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '-';
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('vi-VN') : '-';
}

function toAllergyForm(allergies: MedicalRecordAllergy[]) {
  return allergies.map((allergy) => ({
    allergen: allergy.allergen,
    severity: allergy.severity,
    description: allergy.description ?? '',
  }));
}

// Component dùng chung cho CẢ 2 use case: UC 2.3.2 (Xem bệnh án) và UC 2.3.3
// (Bác sĩ cập nhật bệnh án) — vì giao diện gần như giống hệt nhau, chỉ khác
// ở chỗ có cho sửa hay không (biến `canEdit` bên dưới quyết định việc này).
// Nhiều trang khác nhau (Admin, Lễ tân, Bác sĩ) đều render component này,
// chỉ khác nhau ở việc có quyền sửa hay chỉ được xem.
export function MedicalRecordsWorkspace({ initialPatientId }: { initialPatientId?: string | null } = {}) {
  const { user } = useAuth();
  const pushToast = useNotificationStore((state) => state.push);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialPatientId ?? null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [form, setForm] = useState<UpdateMedicalRecordRequest>(EMPTY_FORM);

  const hasSearched = search.length > 0;
  const query = useMemo(() => ({ page, limit: 20, search: search || undefined }), [page, search]);
  const { data: list, isLoading, error } = useMedicalRecords(query, hasSearched);
  // ĐIỂM BẮT ĐẦU CỦA UC 2.3.2 — ngay khi người dùng CHỌN 1 bệnh nhân từ danh
  // sách tìm kiếm bên trái (setSelectedPatientId ở nút bấm phía dưới),
  // `selectedPatientId` đổi giá trị -> hook này TỰ ĐỘNG gọi API xem bệnh án.
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useMedicalRecord(selectedPatientId);
  // "Cây súng" gọi API lưu bệnh án — dùng ở handleSubmit bên dưới (UC 2.3.3).
  const updateMedicalRecord = useUpdateMedicalRecord();
  // CHỈ tài khoản BÁC SĨ mới được sửa bệnh án — các vai trò khác (Admin, Lễ
  // tân...) chỉ xem được (canEdit=false thì mọi ô nhập bị "disabled").
  const canEdit = user?.role === 'DOCTOR';

  useEffect(() => {
    if (!detail) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      medicalHistory: detail.record?.medicalHistory ?? '',
      clinicalNote: detail.record?.clinicalNote ?? '',
      diagnosisSummary: detail.record?.diagnosisSummary ?? '',
      treatmentSummary: detail.record?.treatmentSummary ?? '',
      followUpNote: detail.record?.followUpNote ?? '',
      allergies: toAllergyForm(detail.allergies),
    });
  }, [detail]);

  // "Lịch sử khám" shows every visit regardless of status — hiding
  // anything not yet COMPLETED made an in-progress or still-waiting visit
  // (or a past no-show/cancellation) invisible here even though the doctor
  // is looking right at it elsewhere in the app; resolveVisitDisplayStatus
  // already gives every status a proper label/badge below.
  const visits = useMemo(() => detail?.visits ?? [], [detail?.visits]);

  useEffect(() => {
    setSelectedVisitId(visits[0]?.id ?? null);
  }, [detail?.patient.id, visits]);

  // ĐIỂM BẮT ĐẦU CỦA UC 2.3.3 — được gọi khi bác sĩ bấm nút "Lưu bệnh án"
  // (submit form) trong khối "Thông tin lâm sàng tổng hợp".
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedPatientId) return;
    // Lớp bảo vệ THỨ 2 ở phía giao diện (lớp thứ nhất là ẩn/khóa nút với
    // canEdit=false) — dù thao tác gì bất thường khiến form submit được,
    // vẫn chặn lại nếu không phải bác sĩ. Backend còn kiểm tra lại LẦN NỮA
    // (xem UpdateMedicalRecordUseCase) nên đây chỉ là hàng rào phụ, không
    // phải nơi bảo mật thật sự.
    if (!canEdit) {
      pushToast({
        variant: 'warning',
        title: 'Không có quyền cập nhật',
        description: 'Chỉ bác sĩ phụ trách mới được cập nhật thông tin lâm sàng.',
      });
      return;
    }

    // Gọi API lưu bệnh án — xem hook useUpdateMedicalRecord() trong
    // use-medical-records.ts để biết chuyện gì xảy ra tiếp theo.
    await updateMedicalRecord.mutateAsync({
      patientId: selectedPatientId,
      input: {
        ...form,
        allergies: form.allergies?.filter((item) => item.allergen.trim()).map((item) => ({
          allergen: item.allergen.trim(),
          severity: item.severity,
          description: item.description?.trim() || undefined,
        })),
      },
    });
  }

  function addAllergy() {
    setForm((value) => ({
      ...value,
      allergies: [...(value.allergies ?? []), { allergen: '', severity: 'MILD', description: '' }],
    }));
  }

  function removeAllergy(index: number) {
    setForm((value) => ({
      ...value,
      allergies: value.allergies?.filter((_, itemIndex) => itemIndex !== index) ?? [],
    }));
  }

  const items = list?.items ?? [];
  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId) ?? visits[0] ?? null;

  return (
    <main className="min-h-full bg-background">
      <PageHeader title="Bệnh án" description="Tra cứu hồ sơ bệnh án, dị ứng, lịch sử khám và kết quả lâm sàng" />

      <section className="grid gap-5 p-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <form
            className="mb-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Mã BN, tên, SĐT"
              />
            </div>
            <Button type="submit" size="icon" variant="secondary" aria-label="Tìm bệnh án">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          <div className="space-y-2">
            {!hasSearched ? (
              <p className="text-sm text-muted-foreground">Nhập từ khoá và nhấn Tìm để tra cứu bệnh án.</p>
            ) : null}
            {hasSearched && isLoading ? <p className="text-sm text-muted-foreground">Đang tải danh sách...</p> : null}
            {hasSearched && error ? <p className="text-sm text-red-700">{error.message}</p> : null}
            {hasSearched && !isLoading && !error && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có bệnh án phù hợp.</p>
            ) : null}
            {hasSearched && items.map((item) => (
              <button
                key={item.patientId}
                type="button"
                onClick={() => setSelectedPatientId(item.patientId)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  selectedPatientId === item.patientId
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-white hover:border-primary/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.fullName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.patientCode}</p>
                  </div>
                  <Badge variant="muted">{item.totalVisits} lượt</Badge>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{item.phone}</p>
              </button>
            ))}
          </div>

          {hasSearched && list?.meta && (
            <div className="mt-3">
              <Pagination page={list.meta.page} totalPages={list.meta.totalPages} total={list.meta.total} onPageChange={setPage} />
            </div>
          )}
        </Card>

        <div className="space-y-5">
          {!selectedPatientId ? (
            <Card className="p-6 text-sm text-muted-foreground">Chọn một bệnh nhân để xem bệnh án.</Card>
          ) : null}

          {isDetailLoading ? <Card className="p-6 text-sm text-muted-foreground">Đang tải bệnh án...</Card> : null}

          {selectedPatientId && detailError ? (
            <Card className="border-destructive/40 p-6">
              <p className="text-sm font-medium text-destructive">Không thể tải chi tiết bệnh án.</p>
              <p className="mt-1 text-sm text-muted-foreground">{detailError.message}</p>
            </Card>
          ) : null}

          {detail ? (
            <>
              <Card className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{detail.patient.fullName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{detail.patient.patientCode}</p>
                  </div>
                  {!canEdit ? (
                    <Badge variant="muted">
                      <ShieldAlert className="mr-1 h-3.5 w-3.5" />
                      Chỉ xem
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <InfoCell label="Ngày sinh" value={formatDate(detail.patient.dateOfBirth)} />
                  <InfoCell label="Giới tính" value={detail.patient.gender} />
                  <InfoCell label="Số điện thoại" value={detail.patient.phone} />
                  <InfoCell label="Email" value={detail.patient.email ?? '-'} />
                </div>
              </Card>

              <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit}>
                <Card className="space-y-4 p-5">
                  <div>
                    <h2 className="text-base font-semibold">Thông tin lâm sàng tổng hợp</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cập nhật bởi bác sĩ trong quá trình thăm khám đang hoạt động
                    </p>
                  </div>
                  <TextAreaField
                    disabled={!canEdit}
                    id="medicalHistory"
                    label="Tiền sử bệnh"
                    value={form.medicalHistory ?? ''}
                    onChange={(value) => setForm((current) => ({ ...current, medicalHistory: value }))}
                  />
                  <TextAreaField
                    disabled={!canEdit}
                    id="clinicalNote"
                    label="Ghi chú lâm sàng"
                    value={form.clinicalNote ?? ''}
                    onChange={(value) => setForm((current) => ({ ...current, clinicalNote: value }))}
                  />
                  <TextAreaField
                    disabled={!canEdit}
                    id="diagnosisSummary"
                    label="Tổng hợp chẩn đoán"
                    value={form.diagnosisSummary ?? ''}
                    onChange={(value) => setForm((current) => ({ ...current, diagnosisSummary: value }))}
                  />
                  <TextAreaField
                    disabled={!canEdit}
                    id="treatmentSummary"
                    label="Điều trị"
                    value={form.treatmentSummary ?? ''}
                    onChange={(value) => setForm((current) => ({ ...current, treatmentSummary: value }))}
                  />
                  <TextAreaField
                    disabled={!canEdit}
                    id="followUpNote"
                    label="Theo dõi sau khám"
                    value={form.followUpNote ?? ''}
                    onChange={(value) => setForm((current) => ({ ...current, followUpNote: value }))}
                  />
                  {canEdit ? (
                    <Button type="submit" disabled={updateMedicalRecord.isPending}>
                      <Save className="h-4 w-4" />
                      Lưu bệnh án
                    </Button>
                  ) : null}
                </Card>

                <Card className="h-fit space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold">Dị ứng</h2>
                      <p className="mt-1 text-sm text-muted-foreground">Quản lý cùng bệnh án</p>
                    </div>
                    {canEdit ? (
                      <Button size="sm" variant="secondary" onClick={addAllergy}>
                        Thêm
                      </Button>
                    ) : null}
                  </div>
                  {form.allergies?.length ? (
                    <div className="space-y-3">
                      {form.allergies.map((allergy, index) => (
                        <div key={index} className="rounded-md border border-border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant={severityVariant[allergy.severity]}>
                              {severityLabel[allergy.severity]}
                            </Badge>
                            {canEdit ? (
                              <button
                                type="button"
                                className="text-xs font-medium text-destructive"
                                onClick={() => removeAllergy(index)}
                              >
                                Xóa
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-3 space-y-2">
                            <Input
                              disabled={!canEdit}
                              value={allergy.allergen}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  allergies: current.allergies?.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, allergen: event.target.value } : item,
                                  ),
                                }))
                              }
                              placeholder="Tác nhân dị ứng"
                            />
                            <select
                              disabled={!canEdit}
                              className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
                              value={allergy.severity}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  allergies: current.allergies?.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, severity: event.target.value as AllergySeverity }
                                      : item,
                                  ),
                                }))
                              }
                            >
                              <option value="MILD">Nhẹ</option>
                              <option value="MODERATE">Trung bình</option>
                              <option value="SEVERE">Nặng</option>
                            </select>
                            <Input
                              disabled={!canEdit}
                              value={allergy.description ?? ''}
                              onChange={(event) =>
                                setForm((current) => ({
                                  ...current,
                                  allergies: current.allergies?.map((item, itemIndex) =>
                                    itemIndex === index ? { ...item, description: event.target.value } : item,
                                  ),
                                }))
                              }
                              placeholder="Mô tả"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa ghi nhận dị ứng.</p>
                  )}
                </Card>
              </form>

              <Card className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">Lịch sử khám</h2>
                </div>
                <div className="space-y-2">
                  {visits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Chưa có lượt khám.</p>
                  ) : null}
                  {visits.map((visit) => {
                    const displayStatus = resolveVisitDisplayStatus({
                      status: visit.status as VisitStatus,
                      createdAt: visit.createdAt,
                    });
                    return (
                      <button
                        key={visit.id}
                        type="button"
                        onClick={() => setSelectedVisitId(visit.id)}
                        className={`flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors md:flex-row md:items-center md:justify-between ${
                          selectedVisit?.id === visit.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div>
                          <p className="font-medium">{visit.serviceName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {visit.doctorName} · {visit.roomName} · {formatDateTime(visit.createdAt)}
                          </p>
                        </div>
                        <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {selectedVisit ? (
                <>
                  <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Stethoscope className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold">Chẩn đoán &amp; kết quả khám</h2>
                    </div>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <InfoCell label="Chẩn đoán" value={selectedVisit.diagnosis ?? '-'} />
                      <InfoCell label="Ghi chú lâm sàng" value={selectedVisit.clinicalNote ?? '-'} />
                      <InfoCell label="Kết quả điều trị" value={selectedVisit.treatmentResult ?? '-'} />
                      <InfoCell label="Ngày hoàn tất" value={formatDateTime(selectedVisit.completedAt)} />
                    </div>
                  </Card>

                  <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold">Kết quả xét nghiệm / CLS</h2>
                    </div>
                    {selectedVisit.paraclinicalResults.length ? (
                      <div className="space-y-3">
                        {selectedVisit.paraclinicalResults.map((result) => (
                          <div key={result.id} className="rounded-md border border-border p-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="font-medium">{result.serviceName}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{result.summary ?? 'Chưa có tóm tắt.'}</p>
                              </div>
                              <Badge variant="muted">{result.status}</Badge>
                            </div>
                            {result.attachments.length ? (
                              <div className="mt-3 space-y-2">
                                {result.attachments.map((attachment) => (
                                  <a
                                    key={attachment.id}
                                    href={attachment.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground hover:border-primary/50"
                                  >
                                    <span className="min-w-0 truncate">Tệp kết quả: {attachment.fileName}</span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {formatDate(attachment.uploadedAt)}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Chưa có kết quả xét nghiệm.</p>
                    )}
                  </Card>

                  <Card className="p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <Pill className="h-5 w-5 text-primary" />
                      <h2 className="text-base font-semibold">Đơn thuốc</h2>
                    </div>
                    <PrescriptionTable visit={selectedVisit} />
                  </Card>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function PrescriptionTable({ visit }: { visit: MedicalRecordVisit | null }) {
  if (!visit?.prescriptions.length) {
    return <p className="text-sm text-muted-foreground">Chưa có đơn thuốc.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/50">
          <tr>
            <TableHead>STT</TableHead>
            <TableHead>Tên thuốc</TableHead>
            <TableHead>Liều dùng</TableHead>
            <TableHead>Cách dùng</TableHead>
            <TableHead>Ghi chú</TableHead>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">
          {visit.prescriptions.map((item, index) => (
            <tr key={item.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>
                <span className="font-medium">{item.medicineName}</span>
              </TableCell>
              <TableCell>{item.dosage}</TableCell>
              <TableCell>
                {item.frequency} trong {item.durationDays} ngày
              </TableCell>
              <TableCell>{item.instruction ?? '-'}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top text-foreground">{children}</td>;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

function TextAreaField({
  disabled,
  id,
  label,
  value,
  onChange,
}: {
  disabled: boolean;
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        disabled={disabled}
        className="min-h-24 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
