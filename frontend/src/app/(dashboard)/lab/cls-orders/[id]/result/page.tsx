'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Paperclip, Plus, Printer, ScanLine, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useClsOrder, useEnterClsResult, useOcrExtractClsResult, useUploadClsAttachment } from '@/hooks/use-cls-orders';
import { clsOrdersApi } from '@/lib/api/endpoints/cls-orders';
import type { LabResultRow } from '@/types/cls-orders';

// Local-only field — never sent to PATCH :id/result (see cleanRows below,
// which only picks the persisted fields explicitly). Marks a row that was
// dropped in from OCR and not yet reviewed/edited by hand.
type EditableLabResultRow = LabResultRow & { fromOcr?: boolean };

const emptyRow: EditableLabResultRow = { name: '', result: '', unit: '', normalRange: '', note: '' };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN');
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

const statusLabel: Record<string, string> = {
  PENDING: 'Chờ gọi',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const statusVariant: Record<string, 'warning' | 'default' | 'success' | 'danger'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export default function ClsResultPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();

  const { data: order, isLoading } = useClsOrder(id);

  const [initialized, setInitialized] = useState(false);
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState('');
  const [rows, setRows] = useState<EditableLabResultRow[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  const resultMutation = useEnterClsResult();
  const uploadMutation = useUploadClsAttachment();
  const ocrMutation = useOcrExtractClsResult();

  const isLab = order?.clsRoomCategory === 'LAB';
  // X-quang/Siêu âm real result slips always carry a physical film/photo —
  // so unlike LAB, these two require at least one image attachment.
  const isImageCategory = order?.clsRoomCategory === 'XRAY' || order?.clsRoomCategory === 'ULTRASOUND';
  const isCompleted = order?.status === 'COMPLETED';
  const hasAttachment = (order?.resultAttachments?.length ?? 0) > 0 || newFiles.length > 0;

  // Two-step save/lock: the order stays IN_PROGRESS and editable across any
  // number of "Lưu" (draft) saves, so re-opening this page must restore
  // whatever was last saved instead of starting from a blank form. Runs
  // once, the first time `order` becomes available.
  useEffect(() => {
    if (!order || initialized) return;
    if (order.status === 'IN_PROGRESS') {
      setSummary(order.resultSummary ?? '');
      setFindings(order.resultFindings ?? '');
      if (isLab) {
        setRows(order.resultRows && order.resultRows.length > 0 ? order.resultRows : [{ ...emptyRow }]);
      }
    }
    setInitialized(true);
  }, [order, initialized, isLab]);

  function updateRow(index: number, patch: Partial<LabResultRow>) {
    // Any hand edit un-marks the row as an unreviewed OCR draft, whether or
    // not it came from OCR in the first place (a no-op for hand-typed rows).
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch, fromOcr: false } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...emptyRow }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOcrFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file || !id) return;

    ocrMutation.mutate(
      { id, file },
      {
        onSuccess: (result) => {
          const extractedRows = result.data?.rows ?? [];
          if (extractedRows.length === 0) return;
          setRows((prev) => {
            // Drop fully-blank placeholder rows (e.g. the seeded first row)
            // so they don't leave a stray empty line mixed with OCR rows —
            // rows the KTV already typed something into are kept as-is.
            const kept = prev.filter(
              (row) => row.name.trim() || row.result.trim() || row.unit?.trim() || row.normalRange?.trim() || row.note?.trim(),
            );
            const ocrRows: EditableLabResultRow[] = extractedRows.map((row) => ({
              name: row.name,
              result: row.result,
              unit: row.unit ?? '',
              normalRange: '',
              note: '',
              fromOcr: true,
            }));
            return [...kept, ...ocrRows];
          });
        },
      },
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    setNewFiles(Array.from(e.target.files));
  }

  function removeFile(idx: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(finalize: boolean) {
    if (!id || !summary.trim()) return;
    if (isImageCategory && !findings.trim()) return;
    if (isImageCategory && !hasAttachment) return;

    const cleanRows = rows
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        result: row.result.trim(),
        unit: row.unit?.trim() || undefined,
        normalRange: row.normalRange?.trim() || undefined,
        note: row.note?.trim() || undefined,
      }));

    await new Promise<void>((resolve, reject) =>
      resultMutation.mutate(
        {
          id,
          input: {
            summary: summary.trim(),
            rows: isLab && cleanRows.length > 0 ? cleanRows : undefined,
            findings: isImageCategory && findings.trim() ? findings.trim() : undefined,
            finalize,
          },
        },
        { onSuccess: () => resolve(), onError: reject },
      ),
    );

    if (newFiles.length > 0) {
      setUploading(true);
      for (const file of newFiles) {
        await new Promise<void>((resolve) =>
          uploadMutation.mutate({ id, file }, { onSuccess: () => resolve(), onError: () => resolve() }),
        );
      }
      setUploading(false);
    }

    setNewFiles([]);
  }

  const isSaving = resultMutation.isPending || uploading;
  const isInProgress = order?.status === 'IN_PROGRESS';
  const showForm = isInProgress;
  const isFormValid = !!summary.trim() && !(isImageCategory && (!findings.trim() || !hasAttachment));

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Đang tải...</div>;
  }

  if (!order) {
    return <div className="p-6 text-sm text-destructive">Không tìm thấy phiếu CLS.</div>;
  }

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/lab/cls-orders')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Hàng chờ
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">{order.patientName}</span>
          <Badge variant={statusVariant[order.status]}>{statusLabel[order.status]}</Badge>
        </div>
        {isCompleted && (
          <a href={clsOrdersApi.printResultUrl(order.id)} target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <Printer className="h-4 w-4" />
              In phiếu kết quả
            </Button>
          </a>
        )}
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[320px_1fr]">
        {/* Left — thông tin phiếu */}
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Thông tin bệnh nhân</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Họ tên</dt>
                <dd className="font-medium text-foreground text-right">{order.patientName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Mã BN</dt>
                <dd className="text-foreground">{order.patientCode}</dd>
              </div>
              {order.dateOfBirth && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Ngày sinh</dt>
                  <dd className="text-foreground">{formatDate(order.dateOfBirth as unknown as string)}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Chỉ định CLS</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Dịch vụ</dt>
                <dd className="font-medium text-foreground text-right">{order.serviceName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phòng</dt>
                <dd className="text-foreground">{order.clsRoomName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Bác sĩ</dt>
                <dd className="text-foreground text-right">{order.doctorName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Giờ tạo</dt>
                <dd className="tabular-nums text-foreground">{formatTime(order.createdAt as unknown as string)}</dd>
              </div>
              {order.note && (
                <div className="pt-1">
                  <dt className="mb-1 text-muted-foreground">Ghi chú</dt>
                  <dd className="rounded-md bg-muted px-3 py-2 text-foreground">{order.note}</dd>
                </div>
              )}
            </dl>
          </Card>
        </div>

        {/* Right — kết quả */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Kết quả CLS</h2>
          </div>

          {showForm ? (
            <div className="space-y-4">
              {isLab && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-foreground">Bảng kết quả xét nghiệm</label>
                    <div className="flex items-center gap-2">
                      {ocrMutation.isPending && (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Đang quét ảnh...
                        </span>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => ocrFileInputRef.current?.click()}
                        disabled={ocrMutation.isPending}
                      >
                        <ScanLine className="h-3.5 w-3.5" />
                        Quét từ ảnh (OCR)
                      </Button>
                      <input
                        ref={ocrFileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className="hidden"
                        onChange={handleOcrFileChange}
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Tên xét nghiệm</th>
                          <th className="px-3 py-2 font-medium">Kết quả</th>
                          <th className="px-3 py-2 font-medium">Đơn vị</th>
                          <th className="px-3 py-2 font-medium">Bình thường</th>
                          <th className="px-3 py-2 font-medium">Ghi chú</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={index} className="border-b border-border last:border-0">
                            <td className="min-w-[180px] p-2 align-top">
                              <div className="flex flex-col gap-1">
                                <Input value={row.name} onChange={(e) => updateRow(index, { name: e.target.value })} placeholder="VD: Glucose" />
                                {row.fromOcr && <span className="whitespace-nowrap text-xs font-medium text-[#004E5F]">Từ OCR — chưa xác nhận</span>}
                              </div>
                            </td>
                            <td className="p-2 align-top"><Input value={row.result} onChange={(e) => updateRow(index, { result: e.target.value })} /></td>
                            <td className="p-2 align-top"><Input value={row.unit ?? ''} onChange={(e) => updateRow(index, { unit: e.target.value })} placeholder="mmol/L" /></td>
                            <td className="p-2 align-top"><Input value={row.normalRange ?? ''} onChange={(e) => updateRow(index, { normalRange: e.target.value })} placeholder="3.9 - 6.4" /></td>
                            <td className="p-2 align-top"><Input value={row.note ?? ''} onChange={(e) => updateRow(index, { note: e.target.value })} /></td>
                            <td className="p-2 align-top">
                              <button type="button" onClick={() => removeRow(index)} className="mt-2 text-muted-foreground hover:text-destructive" aria-label="Xóa dòng">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={addRow}>
                    <Plus className="h-3.5 w-3.5" /> Thêm dòng
                  </Button>
                </div>
              )}

              {isImageCategory && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Mô tả kết quả <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    rows={6}
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    placeholder="Mô tả chi tiết từng vùng/cấu trúc quan sát được..."
                    className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {isLab ? 'Kết luận chung' : isImageCategory ? 'Kết luận' : 'Tóm tắt kết quả'}{' '}
                  <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={isImageCategory ? 3 : 8}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder={isImageCategory ? 'Kết luận ngắn gọn (KL)...' : 'Nhập kết quả xét nghiệm / chẩn đoán hình ảnh...'}
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Đính kèm tệp / hình ảnh
                  {isImageCategory && <span className="text-destructive"> * (bắt buộc ít nhất 1 ảnh)</span>}
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Paperclip className="h-4 w-4" />
                  Chọn tệp (JPG, PNG, PDF — tối đa 10MB)
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {newFiles.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {newFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-sm">
                        <span className="truncate text-foreground">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="ml-3 shrink-0 text-xs text-destructive hover:underline"
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isImageCategory && !hasAttachment && (
                <p className="text-xs text-destructive">Cần đính kèm ít nhất 1 ảnh trước khi lưu kết quả.</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => handleSave(false)}
                  disabled={!isFormValid || isSaving}
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu'}
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  disabled={!isFormValid || isSaving}
                >
                  {isSaving ? 'Đang lưu...' : 'Kết thúc CLS'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                “Lưu” giữ phiếu ở trạng thái đang thực hiện và có thể sửa lại sau. “Kết thúc CLS” xác nhận kết quả cuối cùng, sau đó không thể chỉnh sửa.
              </p>
            </div>
          ) : isCompleted ? (
            <div className="space-y-4">
              {order.resultRows && order.resultRows.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Bảng kết quả xét nghiệm
                  </p>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Tên xét nghiệm</th>
                          <th className="px-3 py-2 font-medium">Kết quả</th>
                          <th className="px-3 py-2 font-medium">Đơn vị</th>
                          <th className="px-3 py-2 font-medium">Bình thường</th>
                          <th className="px-3 py-2 font-medium">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.resultRows.map((row, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="px-3 py-2 font-medium text-foreground">{row.name}</td>
                            <td className="px-3 py-2 text-foreground">{row.result}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.unit || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.normalRange || '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {isImageCategory && order.resultFindings && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Mô tả kết quả
                  </p>
                  <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
                    {order.resultFindings}
                  </p>
                </div>
              )}

              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {isLab ? 'Kết luận chung' : isImageCategory ? 'Kết luận' : 'Tóm tắt'}
                </p>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-foreground">
                  {order.resultSummary ?? '(Chưa có nội dung)'}
                </p>
              </div>

              {(order.resultAttachments ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Tài liệu đính kèm
                  </p>
                  <ul className="flex flex-col gap-1">
                    {(order.resultAttachments ?? []).map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <a
                          href={a.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {a.fileName}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có kết quả.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
