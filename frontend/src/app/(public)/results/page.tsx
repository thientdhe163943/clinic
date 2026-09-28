'use client';

import { useState } from 'react';
import { Search, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { resultsApi } from '@/lib/api/endpoints/results';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';
import type { ExaminationResult } from '@/types/visits';
import type { ApiError } from '@/types/api';

// appointmentTime is a naive VN wall-clock value labeled UTC, not a real UTC
// instant — see formatAppointmentDateTime for why toLocaleString() is wrong here.
function fmt(value: string | null | undefined) {
  if (!value) return '—';
  return formatAppointmentDateTime(value);
}
function fmtDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('vi-VN');
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default function ResultsPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExaminationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setErrorMsg('');
    try {
      const data = await resultsApi.getByCode(trimmed);
      setResult(data);
    } catch (err) {
      setErrorMsg((err as ApiError).message ?? 'Không tìm thấy kết quả');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-start justify-center bg-background p-4 pt-16">
      <div className="w-full max-w-2xl">
        <Card className="p-6">
          <h1 className="text-xl font-semibold">Tra cứu kết quả khám</h1>
          <p className="mt-1 text-sm text-muted-foreground">Nhập mã truy cập trên phiếu kết quả</p>
          <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-3 md:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Nhập mã tra cứu..."
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !code.trim()} className="shrink-0 whitespace-nowrap">
              <Search className="h-4 w-4" />
              {loading ? 'Đang tra cứu...' : 'Tra cứu'}
            </Button>
          </form>

          {errorMsg && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
        </Card>

        {result && (
          <Card className="mt-4 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Kết quả khám</h2>
              <a href={resultsApi.printUrl(result.accessCode)} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm">
                  <Printer className="h-4 w-4" /> In phiếu
                </Button>
              </a>
            </div>

            <div className="grid gap-4 text-sm md:grid-cols-2">
              <Field label="Bệnh nhân" value={result.patientName} />
              <Field label="Mã bệnh nhân" value={result.patientCode} />
              <Field label="Ngày sinh" value={fmtDate(result.patientDateOfBirth) ?? '—'} />
              <Field label="Giới tính" value={result.patientGender} />
              <Field label="Bác sĩ khám" value={result.doctorName} />
              <Field label="Dịch vụ" value={result.serviceName} />
              <Field label="Ngày khám" value={fmt(result.appointmentTime)} />
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <p className="mb-1 text-xs text-muted-foreground">Chẩn đoán</p>
              <p className="text-sm font-medium">{result.diagnosis}</p>
            </div>

            {result.clinicalNote && (
              <div className="mt-3">
                <p className="mb-1 text-xs text-muted-foreground">Ghi chú lâm sàng</p>
                <p className="text-sm">{result.clinicalNote}</p>
              </div>
            )}

            {result.treatmentResult && (
              <div className="mt-3">
                <p className="mb-1 text-xs text-muted-foreground">Kết quả điều trị</p>
                <p className="text-sm">{result.treatmentResult}</p>
              </div>
            )}

            {result.clsSummaries.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">KẾT QUẢ CLS</p>
                <ul className="flex flex-col gap-2">
                  {result.clsSummaries.map((s, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-medium">{s.serviceName}:</span>{' '}
                      <span className="text-muted-foreground">{s.summary ?? 'Chưa có kết quả'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.followUpDate && (
              <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-primary">
                  Ngày tái khám: {fmtDate(result.followUpDate)}
                </p>
              </div>
            )}
          </Card>
        )}
      </div>
    </main>
  );
}
