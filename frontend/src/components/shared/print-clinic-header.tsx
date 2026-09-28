'use client';

import { useClinicInfo } from '@/hooks/use-clinic-info';

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('vi-VN');
}

/**
 * Shared clinic-identity header for print-only slips (visit result,
 * prescription, invoice — see visit-result-print-view.tsx,
 * prescription-print-view.tsx, invoice-print-view.tsx). Mirrors the header
 * block `PdfService.header()` draws server-side for the barcode-bearing
 * PDFs (CLS order/admission slips, which stay server-rendered), but reads
 * the clinic's name/address/phone from the public `/public/clinic-info`
 * endpoint instead of hard-coding them — see docs/coding_style.md mục 8.
 */
export function PrintClinicHeader({ title }: { title: string }) {
  const { data: clinicInfo } = useClinicInfo();

  return (
    <header className="border-b border-black pb-3 text-center">
      <h1 className="text-base font-bold uppercase">{clinicInfo?.name}</h1>
      {clinicInfo?.address ? <p className="text-xs text-gray-700">{clinicInfo.address}</p> : null}
      {clinicInfo?.phone ? <p className="text-xs text-gray-700">Điện thoại: {clinicInfo.phone}</p> : null}
      <h2 className="mt-3 text-lg font-bold uppercase">{title}</h2>
      <p className="mt-0.5 text-xs text-gray-600">In ngày {formatDateTime(new Date().toISOString())}</p>
    </header>
  );
}
