'use client';

import type { Prescription } from '@/types/visits';
import { PrintClinicHeader } from './print-clinic-header';
import { PrintPortal } from './print-portal';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';

/**
 * `Prescription` (see `types/visits.ts`) only carries `visitId`, not the
 * patient/doctor names needed on the printed slip — the caller (visit
 * detail page) already has this from the `VisitListItem` it's rendering
 * the prescription tab for, so it's passed down separately instead of
 * triggering an extra fetch here.
 */
export interface PrescriptionPrintPatient {
  patientName: string;
  patientCode: string;
  doctorName: string;
  appointmentTime: string;
}

/**
 * Print-only layout for a visit's prescription ("Đơn thuốc"). Rendered
 * off-screen (hidden on regular display, shown via `@media print`) so the
 * caller can trigger `window.print()` from the visit detail page without a
 * round-trip to the backend's PDF endpoint — no barcode on this slip.
 * Mirrors `medical-record-print-view.tsx`'s pattern.
 */
export function PrescriptionPrintView({
  prescription,
  patient,
}: {
  prescription: Prescription;
  patient: PrescriptionPrintPatient;
}) {
  const hasWarning = prescription.items.some((item) => item.allergyWarning || item.interactionWarning);

  return (
    <PrintPortal>
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm text-black">
      <PrintClinicHeader title="Đơn thuốc" />

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Thông tin bệnh nhân</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="font-semibold">Họ tên: </span>
            {patient.patientName}
          </p>
          <p>
            <span className="font-semibold">Mã BN: </span>
            {patient.patientCode}
          </p>
          <p>
            <span className="font-semibold">Bác sĩ kê đơn: </span>
            {patient.doctorName}
          </p>
          <p>
            <span className="font-semibold">Ngày kê đơn: </span>
            {formatAppointmentDateTime(patient.appointmentTime)}
          </p>
        </div>
        {prescription.note ? (
          <p className="mt-1">
            <span className="font-semibold">Ghi chú: </span>
            {prescription.note}
          </p>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Danh sách thuốc</h2>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1">STT</th>
              <th className="border border-black px-2 py-1">Tên thuốc</th>
              <th className="border border-black px-2 py-1">Hoạt chất</th>
              <th className="border border-black px-2 py-1">Liều dùng</th>
              <th className="border border-black px-2 py-1">Tần suất</th>
              <th className="border border-black px-2 py-1">Số ngày</th>
              <th className="border border-black px-2 py-1">Hướng dẫn</th>
            </tr>
          </thead>
          <tbody>
            {prescription.items.map((item, i) => (
              <tr key={item.id}>
                <td className="border border-black px-2 py-1 text-center">{i + 1}</td>
                <td className="border border-black px-2 py-1">
                  {item.medicineName}
                  {item.allergyWarning ? ' [DỊ ỨNG]' : ''}
                  {item.interactionWarning ? ' [TƯƠNG TÁC]' : ''}
                </td>
                <td className="border border-black px-2 py-1">{item.activeIngredient}</td>
                <td className="border border-black px-2 py-1">{item.dosage}</td>
                <td className="border border-black px-2 py-1">{item.frequency}</td>
                <td className="border border-black px-2 py-1 text-center">{item.durationDays} ngày</td>
                <td className="border border-black px-2 py-1">{item.instruction ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasWarning ? (
          <p className="mt-2 border border-black px-2 py-1 text-xs font-semibold">
            Lưu ý: Có thuốc có cảnh báo dị ứng hoặc tương tác. Vui lòng tham khảo ý kiến bác sĩ trước khi sử dụng.
          </p>
        ) : null}
      </section>

      <div className="mt-10 flex justify-end">
        <div className="w-48 text-center text-xs">
          <p className="font-semibold">Bác sĩ kê đơn</p>
          <p className="mt-12 text-gray-500">(Ký và ghi rõ họ tên)</p>
        </div>
      </div>
    </div>
    </PrintPortal>
  );
}
