'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ClipboardList,
  FileText,
  FlaskConical,
  HeartPulse,
  Mail,
  MapPin,
  Phone,
  Pill,
  Search,
  Sparkles,
  Stethoscope,
  User,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { PatientPageHeader } from '@/components/shared/patient-page-header';
import { useSummarizeExamResult } from '@/hooks/use-ai-chat';
import { useMedicalRecords, useMyMedicalRecord } from '@/hooks/use-medical-records';
import { resolveVisitDisplayStatus } from '@/lib/utils/visit-status';
import type { AllergySeverity, MedicalRecordDetail, MedicalRecordVisit } from '@/types/medical-records';
import type { VisitStatus } from '@/types/visits';

type WorkspaceMode = 'mine' | 'lookup';

interface MedicalRecordReadonlyWorkspaceProps {
  mode: WorkspaceMode;
}

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

function displayText(value?: string | null) {
  return value?.trim() ? value : 'Chưa có dữ liệu';
}

function isImageAttachment(fileType: string, fileUrl: string) {
  return fileType.toUpperCase().includes('IMAGE') || /\.(png|jpe?g|gif|webp)$/i.test(fileUrl);
}

export function MedicalRecordReadonlyWorkspace({ mode }: MedicalRecordReadonlyWorkspaceProps) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const query = useMemo(() => ({ page: 1, limit: 20, search: search || undefined }), [search]);
  const hasSearched = mode === 'lookup' && search.length > 0;
  const lookupList = useMedicalRecords(query, hasSearched);
  const myRecord = useMyMedicalRecord(mode === 'mine');

  const detail = mode === 'mine' ? myRecord.data : undefined;
  const isLoading = mode === 'mine' ? myRecord.isLoading : false;
  const error = mode === 'mine' ? myRecord.error : null;

  const title = mode === 'mine' ? 'Hồ sơ bệnh án' : 'Tra cứu hồ sơ bệnh án';
  const description =
    mode === 'mine'
      ? 'Xem lịch sử khám, chẩn đoán, kết quả xét nghiệm và đơn thuốc của bạn'
      : 'Tìm bệnh nhân và xem lịch sử bệnh án theo từng lần khám';

  if (mode === 'mine') {
    return (
      <main className="min-h-full bg-background">
        <PatientPageHeader icon={FileText} title={title} description={description} />
        <section className="mx-auto max-w-6xl px-5 pb-10">
          {isLoading ? <EmptyState title="Đang tải bệnh án" description="Dữ liệu hồ sơ bệnh án đang được tải." /> : null}
          {error ? <EmptyState title="Không tải được bệnh án" description={error.message} tone="danger" /> : null}
          {detail ? <MedicalRecordDocument detail={detail} showAiSummary /> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-background">
      <PageHeader title={title} description={description} />

      <section className="space-y-4 p-5">
        <form
          className="flex w-full gap-2 md:max-w-xl"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchInput.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Mã BN, tên, SĐT, email"
            />
          </div>
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" /> Tìm
          </Button>
        </form>

        {!hasSearched ? (
          <EmptyState title="Tra cứu hồ sơ bệnh án" description="Nhập từ khoá và nhấn Tìm để tra cứu hồ sơ bệnh án của bệnh nhân." />
        ) : (
          <div className="space-y-2">
            {lookupList.isLoading ? <p className="text-sm text-muted-foreground">Đang tải danh sách...</p> : null}
            {lookupList.error ? <p className="text-sm text-red-700">{lookupList.error.message}</p> : null}
            {!lookupList.isLoading && !lookupList.error && !lookupList.data?.items.length ? (
              <p className="text-sm text-muted-foreground">Chưa có hồ sơ bệnh án phù hợp.</p>
            ) : null}
            {lookupList.data?.items.map((item) => (
              <Card key={item.patientId} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.fullName}</p>
                    <Link
                      href={`/medical-record/${item.patientId}`}
                      className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                    >
                      {item.patientCode}
                    </Link>
                  </div>
                  <Badge variant="muted">{item.totalVisits} lượt</Badge>
                </div>
                <p className="mt-2 truncate text-xs text-muted-foreground">{item.phone}</p>
                {item.email ? <p className="mt-1 truncate text-xs text-muted-foreground">{item.email}</p> : null}
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

interface MedicalRecordDocumentProps {
  detail: MedicalRecordDetail;
  printSelection?: {
    selectedVisitIds: string[];
    onToggleVisit: (visitId: string) => void;
  };
  // Feature 85 business rule: "Chỉ áp dụng với kết quả khám của chính bệnh
  // nhân đó" — the backend endpoint only allows PATIENT role, so this button
  // must stay off for the staff-facing lookup-by-patientId view that also
  // renders this same component.
  showAiSummary?: boolean;
}

export function MedicalRecordDocument({ detail, printSelection, showAiSummary }: MedicalRecordDocumentProps) {
  // "Lịch sử khám bệnh" shows every visit regardless of status — hiding
  // anything not yet COMPLETED made an in-progress or still-waiting visit
  // (or a past no-show/cancellation) invisible here even though the user
  // is looking right at it elsewhere in the app; resolveVisitDisplayStatus
  // already gives every status a proper label/badge below.
  const visits = detail.visits;

  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(visits[0]?.id ?? null);
  const [aiSummaryVisitId, setAiSummaryVisitId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedVisitId(visits[0]?.id ?? null);
  }, [detail.patient.id, visits]);

  const selectedVisit = visits.find((visit) => visit.id === selectedVisitId) ?? visits[0] ?? null;
  const selectedVisitDisplayStatus = selectedVisit
    ? resolveVisitDisplayStatus({ status: selectedVisit.status as VisitStatus, createdAt: selectedVisit.createdAt })
    : null;
  const aiSummary = useSummarizeExamResult(aiSummaryVisitId, showAiSummary === true && aiSummaryVisitId !== null);
  const hasClinicalData = Boolean(
    detail.record ||
      detail.allergies.length ||
      visits.length ||
      selectedVisit?.diagnosis ||
      selectedVisit?.clinicalNote ||
      selectedVisit?.treatmentResult ||
      selectedVisit?.paraclinicalResults.length ||
      selectedVisit?.prescriptions.length,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Thông tin bệnh nhân</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <PatientInfoStat icon={Calendar} label="Ngày sinh" value={formatDate(detail.patient.dateOfBirth)} />
            <PatientInfoStat icon={Phone} label="Số điện thoại" value={detail.patient.phone} />
            <PatientInfoStat icon={Mail} label="Email" value={detail.patient.email ?? '-'} />
            <PatientInfoStat icon={MapPin} label="Địa chỉ" value={detail.patient.address ?? '-'} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Tóm tắt lần khám gần nhất</h2>
            </div>
            {selectedVisitDisplayStatus ? (
              <Badge variant={selectedVisitDisplayStatus.variant}>{selectedVisitDisplayStatus.label}</Badge>
            ) : null}
          </div>
          {selectedVisit ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-medium text-muted-foreground">Ngày khám: </span>
                {formatDate(selectedVisit.completedAt ?? selectedVisit.createdAt)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Bác sĩ: </span>
                {selectedVisit.doctorName}
              </p>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">Chẩn đoán</p>
                <p className="mt-1 text-sm text-foreground">{displayText(selectedVisit.diagnosis)}</p>
              </div>
            </div>
          ) : detail.record?.diagnosisSummary ? (
            // Some patient records only have the legacy aggregate MedicalRecordBase
            // populated with no matching per-visit rows yet — same fallback the
            // "Chẩn đoán"/"Kết quả khám" sections below already use, so this card
            // doesn't claim "no exam" while real diagnosis data exists right underneath it.
            <div className="rounded-md bg-muted/40 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Chẩn đoán</p>
              <p className="mt-1 text-sm text-foreground">{displayText(detail.record.diagnosisSummary)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có lần khám nào.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Kết quả xét nghiệm</h2>
          </div>
          {selectedVisit?.paraclinicalResults.length ? (
            <div className="space-y-2">
              {selectedVisit.paraclinicalResults.map((result) => (
                <div key={result.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate text-sm font-medium text-foreground">{result.serviceName}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {result.attachments[0] ? <span>{formatDate(result.attachments[0].uploadedAt)}</span> : null}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
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
            <h2 className="text-base font-semibold">Đơn thuốc hiện tại</h2>
          </div>
          {selectedVisit?.prescriptions.length ? (
            <div className="space-y-3">
              {selectedVisit.prescriptions.map((item) => (
                <div key={item.id} className="rounded-md border-l-4 border-primary bg-muted/30 p-3">
                  <p className="font-semibold text-foreground">{item.medicineName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.dosage} — {item.frequency}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dùng trong {item.durationDays} ngày{item.instruction ? ` · ${item.instruction}` : ''}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có đơn thuốc.</p>
          )}
        </Card>
      </div>

      {!hasClinicalData ? (
        <EmptyState title="Chưa có dữ liệu về bệnh án" description="Hồ sơ này chưa có lịch sử khám hoặc dữ liệu lâm sàng." />
      ) : null}

      <RecordSection icon={AlertTriangle} title="Tiền sử dị ứng">
        {detail.allergies.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {detail.allergies.map((allergy) => (
              <div key={allergy.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{allergy.allergen}</p>
                  <Badge variant={severityVariant[allergy.severity]}>{severityLabel[allergy.severity]}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{allergy.description ?? 'Chưa có mô tả.'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa ghi nhận dị ứng.</p>
        )}
      </RecordSection>

      <RecordSection icon={ClipboardList} title="Lịch sử khám bệnh">
        {visits.length ? (
          <div className="space-y-2">
            {visits.map((visit) => {
              const displayStatus = resolveVisitDisplayStatus({
                status: visit.status as VisitStatus,
                createdAt: visit.createdAt,
              });
              return (
                <div
                  key={visit.id}
                  className={`flex w-full flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between ${
                    selectedVisit?.id === visit.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {printSelection ? (
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-input"
                        checked={printSelection.selectedVisitIds.includes(visit.id)}
                        onChange={() => printSelection.onToggleVisit(visit.id)}
                        aria-label={`Chọn lần khám ${formatDate(visit.completedAt ?? visit.createdAt)}`}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedVisitId(visit.id)}
                      className="text-left transition-colors hover:text-primary"
                    >
                      <span className="block text-sm font-semibold">{formatDate(visit.completedAt ?? visit.createdAt)}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {visit.doctorName} - {visit.serviceName}
                      </span>
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {showAiSummary ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setAiSummaryVisitId(visit.id)}
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Tóm tắt bằng AI
                      </Button>
                    ) : null}
                    <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có lịch sử khám bệnh.</p>
        )}
      </RecordSection>

      <RecordSection icon={Stethoscope} title="Chẩn đoán">
        <p className="text-sm leading-6">{displayText(selectedVisit?.diagnosis ?? detail.record?.diagnosisSummary)}</p>
      </RecordSection>

      <RecordSection icon={HeartPulse} title="Kết quả khám">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoCell label="Khám lâm sàng" value={displayText(selectedVisit?.clinicalNote ?? detail.record?.clinicalNote)} />
          <InfoCell label="Kết quả điều trị" value={displayText(selectedVisit?.treatmentResult)} />
          <InfoCell label="Ngày hoàn tất" value={formatDateTime(selectedVisit?.completedAt)} />
          <InfoCell label="Tiền sử bệnh" value={displayText(detail.record?.medicalHistory)} />
        </div>
      </RecordSection>

      <RecordSection icon={FlaskConical} title="Kết quả xét nghiệm">
        {selectedVisit?.paraclinicalResults.length ? (
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
                        <span className="min-w-0 truncate">
                          {isImageAttachment(attachment.fileType, attachment.fileUrl) ? 'Ảnh kết quả: ' : 'Tệp kết quả: '}
                          {attachment.fileName}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatDate(attachment.uploadedAt)}</span>
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
      </RecordSection>

      <RecordSection icon={FileText} title="Kết luận sau khám">
        <div className="space-y-2 text-sm leading-6">
          <p>
            <span className="font-semibold">Tóm tắt: </span>
            {displayText(detail.record?.treatmentSummary ?? selectedVisit?.treatmentResult)}
          </p>
          <p>
            <span className="font-semibold">Hướng dẫn: </span>
            {displayText(detail.record?.followUpNote)}
          </p>
          <p>
            <span className="font-semibold">Tái khám: </span>
            {formatDate(selectedVisit?.followUpDate)}
          </p>
        </div>
      </RecordSection>

      <RecordSection icon={Pill} title="Đơn thuốc">
        <PrescriptionTable visit={selectedVisit} />
      </RecordSection>

      {showAiSummary ? (
        <Dialog
          open={aiSummaryVisitId !== null}
          onClose={() => setAiSummaryVisitId(null)}
          title="Tóm tắt kết quả khám bằng AI"
        >
          {aiSummary.isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tóm tắt...</p>
          ) : aiSummary.error ? (
            <p className="text-sm text-red-700">{aiSummary.error.message}</p>
          ) : aiSummary.data ? (
            <div className="space-y-3">
              <p className="whitespace-pre-line text-sm leading-6 text-foreground">{aiSummary.data.summary}</p>
              <p className="text-xs text-muted-foreground">{aiSummary.data.disclaimer}</p>
            </div>
          ) : null}
        </Dialog>
      ) : null}
    </div>
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
            <TableHead>Số lượng</TableHead>
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
              <TableCell>-</TableCell>
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

function RecordSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

function PatientInfoStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-muted/40 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  tone = 'muted',
}: {
  title: string;
  description: string;
  tone?: 'muted' | 'danger';
}) {
  return (
    <Card className={`p-6 ${tone === 'danger' ? 'border-red-200 bg-red-50 text-red-800' : ''}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </Card>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-muted-foreground">{children}</th>;
}

function TableCell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top text-foreground">{children}</td>;
}
