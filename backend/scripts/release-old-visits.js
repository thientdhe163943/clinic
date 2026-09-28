/**
 * release-old-visits.js
 *
 * Giải phóng (complete / cancel) các visit còn treo từ ngày hôm trước
 * ở phòng da liễu (hoặc phòng chỉ định bằng --room).
 *
 * Mặc định: DRY RUN — chỉ in ra danh sách, không thay đổi DB.
 * Thêm --execute để thực sự cập nhật.
 *
 * Cách dùng:
 *   node scripts/release-old-visits.js
 *   node scripts/release-old-visits.js --room="Da Liễu"
 *   node scripts/release-old-visits.js --execute
 *   node scripts/release-old-visits.js --room="Da Liễu" --execute
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const roomArg = (args.find((a) => a.startsWith('--room=')) ?? '').replace('--room=', '') || 'da liễu';

// ── Constants ─────────────────────────────────────────────────────────────────
// System actor — dùng account admin để ghi cancelledBy
const SYSTEM_ACTOR_ID = 'u0000001-0000-0000-0000-000000000001'; // Nguyễn Văn Admin

// Vietnam UTC+7 — start of today local time expressed in UTC
const NOW = new Date();
const START_OF_TODAY_UTC = new Date(
  Date.UTC(
    NOW.getUTCFullYear(),
    NOW.getUTCMonth(),
    NOW.getUTCDate(),
    0 - 7, // subtract UTC+7 offset so midnight VN = 17:00 prev day UTC
    0,
    0,
    0,
  ),
);

const ACTIVE_VISIT_STATUSES = ['WAITING', 'CALLED', 'IN_PROGRESS', 'AWAITING_RESULTS'];

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('  RELEASE OLD VISITS — phòng:', roomArg.toUpperCase());
  console.log('  Mode:', DRY_RUN ? '🔍 DRY RUN (thêm --execute để thực thi)' : '⚡ EXECUTE');
  console.log('  Cut-off: visits trước', START_OF_TODAY_UTC.toISOString(), '(00:00 VN)');
  console.log('='.repeat(70));

  // 1. Tìm phòng da liễu theo tên (không phân biệt hoa/thường)
  const rooms = await prisma.room.findMany({
    where: {
      name: { contains: roomArg },
      deletedAt: null,
    },
    select: { id: true, name: true, roomCode: true },
  });

  if (rooms.length === 0) {
    console.log(`\n❌ Không tìm thấy phòng nào có tên chứa "${roomArg}". Kiểm tra lại --room.`);
    return;
  }

  console.log(`\n✅ Phòng tìm thấy (${rooms.length}):`);
  rooms.forEach((r) => console.log(`   [${r.roomCode}] ${r.name}  id=${r.id}`));

  const roomIds = rooms.map((r) => r.id);

  // 2. Tìm tất cả visit còn active từ ngày cũ ở các phòng đó
  const visits = await prisma.visit.findMany({
    where: {
      roomId: { in: roomIds },
      status: { in: ACTIVE_VISIT_STATUSES },
      createdAt: { lt: START_OF_TODAY_UTC },
    },
    include: {
      patient: { select: { fullName: true, patientCode: true } },
      doctor: { select: { fullName: true } },
      room: { select: { name: true } },
      examinationResult: { select: { id: true } },
      clsOrders: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (visits.length === 0) {
    console.log('\n✅ Không có visit cũ còn treo. Không cần làm gì.');
    return;
  }

  // 3. Phân loại: có thể COMPLETE hay chỉ CANCEL
  const toComplete = [];
  const toCancel = [];

  for (const v of visits) {
    const hasResult = !!v.examinationResult;
    const hasIncompleteCls = v.clsOrders.some((o) =>
      ['PENDING', 'IN_PROGRESS'].includes(o.status),
    );

    if (hasResult && !hasIncompleteCls) {
      toComplete.push(v);
    } else {
      toCancel.push(v);
    }
  }

  // 4. In preview
  console.log(`\n📋 Tổng: ${visits.length} visit cũ còn treo`);

  if (toComplete.length > 0) {
    console.log(`\n🟢 SẼ COMPLETE (có kết quả khám, không còn CLS tồn đọng): ${toComplete.length}`);
    toComplete.forEach((v) => printVisit(v));
  }

  if (toCancel.length > 0) {
    console.log(`\n🟡 SẼ CANCEL (thiếu kết quả khám hoặc còn CLS chưa xong): ${toCancel.length}`);
    toCancel.forEach((v) => {
      const reasons = [];
      if (!v.examinationResult) reasons.push('chưa có kết quả khám');
      const incomplete = v.clsOrders.filter((o) => ['PENDING', 'IN_PROGRESS'].includes(o.status));
      if (incomplete.length) reasons.push(`${incomplete.length} CLS chưa xong`);
      printVisit(v, reasons.join(', '));
    });
  }

  if (DRY_RUN) {
    console.log('\n⏸  DRY RUN — không thay đổi gì. Thêm --execute để thực thi.\n');
    return;
  }

  // 5. Thực thi
  console.log('\n⚡ Đang cập nhật DB...\n');
  const completedAt = new Date();
  let successCount = 0;
  let failCount = 0;

  // 5a. Complete
  for (const v of toComplete) {
    try {
      await prisma.$transaction([
        prisma.visit.update({
          where: { id: v.id },
          data: { status: 'COMPLETED', completedAt },
        }),
        prisma.appointment.update({
          where: { id: v.appointmentId },
          data: { status: 'COMPLETED' },
        }),

      ]);
      console.log(`  ✅ COMPLETED  ${v.patient.patientCode} — ${v.patient.fullName}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Lỗi visit ${v.id}:`, err.message);
      failCount++;
    }
  }

  // 5b. Cancel (+ cancel CLS orders còn pending/in-progress)
  for (const v of toCancel) {
    try {
      const incompleteClsIds = v.clsOrders
        .filter((o) => ['PENDING', 'IN_PROGRESS'].includes(o.status))
        .map((o) => o.id);

      await prisma.$transaction([
        prisma.visit.update({
          where: { id: v.id },
          data: { status: 'CANCELLED' },
        }),
        prisma.appointment.update({
          where: { id: v.appointmentId },
          data: {
            status: 'CANCELLED',
            cancelReason: 'Tự động hủy — visit cũ chưa hoàn thành (dọn dẹp cuối ngày)',
            cancelledBy: SYSTEM_ACTOR_ID,
            cancelledAt: completedAt,
          },
        }),
        ...(incompleteClsIds.length > 0
          ? [
              prisma.clsOrder.updateMany({
                where: { id: { in: incompleteClsIds } },
                data: { status: 'CANCELLED' },
              }),
            ]
          : []),
      ]);
      console.log(`  🚫 CANCELLED  ${v.patient.patientCode} — ${v.patient.fullName}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Lỗi visit ${v.id}:`, err.message);
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  Xong: ${successCount} thành công, ${failCount} lỗi`);
  console.log('='.repeat(70) + '\n');
}

function printVisit(v, reason) {
  const cls = v.clsOrders.length
    ? ` | CLS: ${v.clsOrders.map((o) => o.status).join(', ')}`
    : '';
  const extra = reason ? ` ← ${reason}` : '';
  console.log(
    `   [${v.status.padEnd(18)}] ${v.patient.patientCode} ${v.patient.fullName.padEnd(25)} ` +
      `| bác sĩ: ${v.doctor.fullName}${cls}${extra}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
