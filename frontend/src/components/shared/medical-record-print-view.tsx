'use client';

import type { MedicalRecordPrintView as MedicalRecordPrintData } from '@/types/medical-records';
import { PrintPortal } from './print-portal';

const severityLabel: Record<string, string> = {
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  SEVERE: 'Nặng',
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

/**
 * Print-only layout for a medical record. Rendered off-screen (hidden on
 * regular display, shown via `@media print`) so the caller can trigger
 * `window.print()` without navigating away from the detail page.
 */
export function MedicalRecordPrintView({ data }: { data: MedicalRecordPrintData }) {
  return (
    <PrintPortal>
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-sm text-black">
      <header className="text-center">
        <h1 className="text-lg font-bold uppercase">Phiếu bệnh án</h1>
        <p className="mt-1 text-xs text-gray-600">In ngày {formatDateTime(new Date().toISOString())}</p>
      </header>

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Thông tin bệnh nhân</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <p>
            <span className="font-semibold">Họ tên: </span>
            {data.patient.fullName}
          </p>
          <p>
            <span className="font-semibold">Mã BN: </span>
            {data.patient.patientCode}
          </p>
          <p>
            <span className="font-semibold">Ngày sinh: </span>
            {formatDate(data.patient.dateOfBirth)}
          </p>
          <p>
            <span className="font-semibold">Giới tính: </span>
            {data.patient.gender === 'MALE' ? 'Nam' : data.patient.gender === 'FEMALE' ? 'Nữ' : 'Khác'}
          </p>
          <p>
            <span className="font-semibold">Số điện thoại: </span>
            {data.patient.phone}
          </p>
          <p>
            <span className="font-semibold">Địa chỉ: </span>
            {data.patient.address ?? '-'}
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">Tiền sử dị ứng</h2>
        {data.allergies.length ? (
          <ul className="list-disc space-y-1 pl-5">
            {data.allergies.map((allergy) => (
              <li key={allergy.id}>
                {allergy.allergen} ({severityLabel[allergy.severity] ?? allergy.severity})
                {allergy.description ? ` — ${allergy.description}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p>Chưa ghi nhận dị ứng.</p>
        )}
      </section>

      {data.visits.map((visit, index) => (
        <section key={visit.id} className="break-inside-avoid">
          <h2 className="mb-2 border-b border-black pb-1 text-sm font-bold uppercase">
            Lần khám {index + 1} — {formatDate(visit.completedAt ?? visit.createdAt)}
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            <p>
              <span className="font-semibold">Bác sĩ: </span>
              {visit.doctorName}
            </p>
            <p>
              <span className="font-semibold">Dịch vụ: </span>
              {visit.serviceName}
            </p>
            <p>
              <span className="font-semibold">Phòng: </span>
              {visit.roomName}
            </p>
            <p>
              <span className="font-semibold">Trạng thái: </span>
              {visit.status}
            </p>
          </div>
          <p className="mt-2">
            <span className="font-semibold">Chẩn đoán: </span>
            {displayText(visit.diagnosis)}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Ghi chú lâm sàng: </span>
            {displayText(visit.clinicalNote)}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Kết quả điều trị: </span>
            {displayText(visit.treatmentResult)}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Ngày tái khám: </span>
            {formatDate(visit.followUpDate)}
          </p>

          {visit.paraclinicalResults.length ? (
            <div className="mt-2">
              <p className="font-semibold">Kết quả cận lâm sàng:</p>
              <ul className="list-disc space-y-1 pl-5">
                {visit.paraclinicalResults.map((result) => (
                  <li key={result.id}>
                    {result.serviceName}: {result.summary ?? 'Chưa có tóm tắt'} ({result.status})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {visit.prescriptions.length ? (
            <table className="mt-2 w-full border-collapse border border-black text-xs">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1">STT</th>
                  <th className="border border-black px-2 py-1">Tên thuốc</th>
                  <th className="border border-black px-2 py-1">Liều dùng</th>
                  <th className="border border-black px-2 py-1">Cách dùng</th>
                  <th className="border border-black px-2 py-1">Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {visit.prescriptions.map((item, itemIndex) => (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-1 text-center">{itemIndex + 1}</td>
                    <td className="border border-black px-2 py-1">{item.medicineName}</td>
                    <td className="border border-black px-2 py-1">{item.dosage}</td>
                    <td className="border border-black px-2 py-1">
                      {item.frequency} trong {item.durationDays} ngày
                    </td>
                    <td className="border border-black px-2 py-1">{item.instruction ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2">Chưa có đơn thuốc.</p>
          )}
        </section>
      ))}
    </div>
    </PrintPortal>
  );
}
