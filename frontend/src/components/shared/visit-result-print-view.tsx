'use client';

import type { ExaminationResult } from '@/types/visits';
import { PrintClinicHeader } from './print-clinic-header';
import { PrintPortal } from './print-portal';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';

const genderLabel: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('vi-VN') : '—';
}

/**
 * Print-only layout for a visit's examination result ("Phiếu kết quả khám
 * bệnh"). Rendered off-screen (hidden on regular display, shown via
 * `@media print`) so the caller can trigger `window.print()` from the visit
 * detail page without a round-trip to the backend's PDF endpoint — no
 * barcode on this slip, so nothing needs to stay server-rendered. Mirrors
 * `medical-record-print-view.tsx`'s pattern.
 */
export function VisitResultPrintView({ data }: { data: ExaminationResult }) {
  return (
    <PrintPortal>
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm text-black">
      <PrintClinicHeader title="Phiếu kết quả khám bệnh" />

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Thông tin bệnh nhân</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="font-semibold">Họ tên: </span>
            {data.patientName}
          </p>
          <p>
            <span className="font-semibold">Mã BN: </span>
            {data.patientCode}
          </p>
          <p>
            <span className="font-semibold">Ngày sinh: </span>
            {formatDate(data.patientDateOfBirth)}
          </p>
          <p>
            <span className="font-semibold">Giới tính: </span>
            {genderLabel[data.patientGender] ?? data.patientGender}
          </p>
          <p>
            <span className="font-semibold">Bác sĩ khám: </span>
            {data.doctorName}
          </p>
          <p>
            <span className="font-semibold">Dịch vụ: </span>
            {data.serviceName}
          </p>
          <p>
            <span className="font-semibold">Ngày khám: </span>
            {formatAppointmentDateTime(data.appointmentTime)}
          </p>
          {data.patientAddress ? (
            <p>
              <span className="font-semibold">Địa chỉ: </span>
              {data.patientAddress}
            </p>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Kết quả khám</h2>
        <table className="w-full border-collapse border border-black text-xs">
          <tbody>
            <tr>
              <td className="w-40 border border-black px-2 py-1.5 font-semibold align-top">Chẩn đoán</td>
              <td className="border border-black px-2 py-1.5">{data.diagnosis}</td>
            </tr>
            {data.clinicalNote ? (
              <tr>
                <td className="border border-black px-2 py-1.5 font-semibold align-top">Ghi chú lâm sàng</td>
                <td className="border border-black px-2 py-1.5">{data.clinicalNote}</td>
              </tr>
            ) : null}
            {data.treatmentResult ? (
              <tr>
                <td className="border border-black px-2 py-1.5 font-semibold align-top">Kết quả điều trị</td>
                <td className="border border-black px-2 py-1.5">{data.treatmentResult}</td>
              </tr>
            ) : null}
            {data.followUpDate ? (
              <tr>
                <td className="border border-black px-2 py-1.5 font-semibold">Ngày tái khám</td>
                <td className="border border-black px-2 py-1.5">{formatDate(data.followUpDate)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {data.clsSummaries.length > 0 ? (
        <section>
          <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Kết quả cận lâm sàng</h2>
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1 text-left">Dịch vụ CLS</th>
                <th className="border border-black px-2 py-1 text-left">Kết quả / Kết luận</th>
              </tr>
            </thead>
            <tbody>
              {data.clsSummaries.map((s, i) => (
                <tr key={i}>
                  <td className="border border-black px-2 py-1">{s.serviceName}</td>
                  <td className="border border-black px-2 py-1">{s.summary ?? 'Chưa có kết quả'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <section className="border border-black px-3 py-2">
        <p>
          <span className="font-semibold">Mã tra cứu kết quả trực tuyến: </span>
          {data.accessCode}
        </p>
      </section>

      <div className="mt-10 grid grid-cols-2 gap-6 text-center text-xs">
        <div>
          <p className="font-semibold">Bác sĩ khám</p>
          <p className="mt-12 text-gray-500">(Ký và ghi rõ họ tên)</p>
        </div>
        <div>
          <p className="font-semibold">Xác nhận phòng khám</p>
          <p className="mt-12 text-gray-500">(Đóng dấu, ký và ghi rõ họ tên)</p>
        </div>
      </div>
    </div>
    </PrintPortal>
  );
}
