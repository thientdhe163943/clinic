'use client';

import type { ClsOrder } from '@/types/visits';
import { PrintClinicHeader } from './print-clinic-header';
import { formatAppointmentDateTime } from '@/lib/utils/appointment-datetime';

const genderLabel: Record<string, string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

function birthYearAndAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—';
  const d = new Date(dateOfBirth);
  if (isNaN(d.getTime())) return '—';
  const year = d.getFullYear();
  const age = new Date().getFullYear() - year;
  return `${year} (${age} tuổi)`;
}

/**
 * Print-only layout for a visit's CLS order slip ("Phiếu chỉ định cận lâm
 * sàng"). Rendered off-screen (print-only class) so `window.print()` on the
 * visit detail page produces the slip without a backend round-trip. No price
 * column — intentional (giá không in trên phiếu chỉ định).
 */
export function ClsOrdersPrintView({
  orders,
  diagnosis,
}: {
  orders: ClsOrder[];
  diagnosis?: string;
}) {
  if (orders.length === 0) return null;

  const first = orders[0];

  // Group by CLS room, preserving insertion order
  const roomOrder: string[] = [];
  const grouped: Record<string, ClsOrder[]> = {};
  for (const o of orders) {
    if (!grouped[o.clsRoomName]) {
      grouped[o.clsRoomName] = [];
      roomOrder.push(o.clsRoomName);
    }
    grouped[o.clsRoomName].push(o);
  }

  return (
    <div className="print-only mx-auto max-w-3xl space-y-5 bg-white p-8 text-sm text-black">
      <PrintClinicHeader title="Phiếu chỉ định cận lâm sàng" />

      {/* Thông tin bệnh nhân */}
      <section className="space-y-0.5">
        <p>
          <span className="font-semibold">Họ tên người bệnh: </span>
          {first.patientName}
          {'  '}
          <span className="font-semibold">NS: </span>
          {birthYearAndAge(first.dateOfBirth)}
          {'  '}
          {genderLabel[first.gender] ?? first.gender}
        </p>
        <p>
          <span className="font-semibold">Mã BN: </span>
          {first.patientCode}
        </p>
        <p>
          <span className="font-semibold">Bác sĩ chỉ định: </span>
          BS. {first.doctorName}
        </p>
        <p>
          <span className="font-semibold">Ngày chỉ định: </span>
          {formatAppointmentDateTime(first.appointmentTime)}
        </p>
        {diagnosis ? (
          <p>
            <span className="font-semibold">Chẩn đoán: </span>
            {diagnosis}
          </p>
        ) : null}
      </section>

      {/* Bảng dịch vụ nhóm theo phòng */}
      <section>
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr>
              <th className="border border-black px-2 py-1 text-center">STT</th>
              <th className="border border-black px-2 py-1 text-left">Tên dịch vụ</th>
              <th className="border border-black px-2 py-1 text-center">Đơn vị tính</th>
              <th className="border border-black px-2 py-1 text-center">Số lượng</th>
              <th className="border border-black px-2 py-1 text-left">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {roomOrder.map((roomName, roomIdx) => {
              const roomOrders = grouped[roomName];
              return (
                <>
                  <tr key={`room-${roomIdx}`}>
                    <td
                      colSpan={5}
                      className="border border-black bg-gray-100 px-2 py-1 font-bold uppercase"
                    >
                      {toRoman(roomIdx + 1)}. {roomName}
                    </td>
                  </tr>
                  {roomOrders.map((o, i) => (
                    <tr key={o.id}>
                      <td className="border border-black px-2 py-1 text-center">{i + 1}</td>
                      <td className="border border-black px-2 py-1">{o.serviceName}</td>
                      <td className="border border-black px-2 py-1 text-center">Lần</td>
                      <td className="border border-black px-2 py-1 text-center">1</td>
                      <td className="border border-black px-2 py-1">{o.note ?? ''}</td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Chữ ký */}
      <div className="mt-10 flex justify-end">
        <div className="w-52 text-center text-xs">
          <p>
            Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm{' '}
            {new Date().getFullYear()}
          </p>
          <p className="mt-1 font-bold uppercase">Bác sĩ chỉ định</p>
          <p className="mt-14 text-gray-600">(Ký và ghi rõ họ tên)</p>
          <p className="font-semibold">BS. {first.doctorName}</p>
        </div>
      </div>
    </div>
  );
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function toRoman(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}
