'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { MedicalRecordDocument } from '@/components/shared/medical-record-readonly-workspace';
import { MedicalRecordPrintView } from '@/components/shared/medical-record-print-view';
import { useMedicalRecord, useMedicalRecordPrint } from '@/hooks/use-medical-records';

export default function MedicalRecordDetailPage() {
  const params = useParams();
  const patientId = Array.isArray(params.patientId) ? params.patientId[0] : params.patientId;

  const { data: detail, isLoading, error } = useMedicalRecord(patientId);

  const [selectedVisitIds, setSelectedVisitIds] = useState<string[]>([]);
  const [printRequested, setPrintRequested] = useState(false);

  const { data: printData, isFetching: isPrinting } = useMedicalRecordPrint(patientId, selectedVisitIds, printRequested);

  useEffect(() => {
    if (printRequested && printData) {
      const timeout = setTimeout(() => {
        window.print();
        setPrintRequested(false);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [printRequested, printData]);

  const toggleVisit = (visitId: string) => {
    setSelectedVisitIds((prev) => (prev.includes(visitId) ? prev.filter((id) => id !== visitId) : [...prev, visitId]));
  };

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title={detail ? `Hồ sơ bệnh án — ${detail.patient.fullName}` : 'Hồ sơ bệnh án'}
        description={detail ? `Mã BN ${detail.patient.patientCode}` : undefined}
        action={
          <div className="flex items-center gap-2">
            {detail ? (
              <Button
                type="button"
                variant="secondary"
                disabled={isPrinting}
                onClick={() => setPrintRequested(true)}
              >
                <Printer className="h-4 w-4" /> {isPrinting ? 'Đang chuẩn bị...' : 'In phiếu bệnh án'}
              </Button>
            ) : null}
            <Link href="/medical-record">
              <Button variant="secondary">Trở về tra cứu</Button>
            </Link>
          </div>
        }
      />

      <section className="space-y-4 p-5">
        {isLoading ? <p className="text-sm text-muted-foreground">Đang tải hồ sơ bệnh án...</p> : null}
        {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        {detail ? (
          <>
            <p className="text-xs text-muted-foreground">
              Tick chọn lần khám muốn in ở mục &quot;Lịch sử khám bệnh&quot; bên dưới. Không chọn gì sẽ in tất cả các lần
              khám.
            </p>
            <MedicalRecordDocument
              detail={detail}
              printSelection={{ selectedVisitIds, onToggleVisit: toggleVisit }}
            />
          </>
        ) : null}
      </section>

      {printData ? <MedicalRecordPrintView data={printData} /> : null}
    </div>
  );
}
