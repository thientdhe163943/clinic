/**
 * seed-realistic-clinic.js
 *
 * Populates a fresh database with a realistic, internally-consistent
 * operational dataset for a ~24-staff outpatient clinic: specialties, rooms,
 * services, staff (+ doctor profiles + work schedules), medicines, supply
 * chain (categories/suppliers/supplies/imports/transactions), patients, and
 * ~5 weeks of appointments/visits with full downstream clinical + billing
 * chains (vital signs, examination results, CLS orders/results,
 * prescriptions, invoices/payments).
 *
 * Pattern follows scripts/release-old-visits.js: plain CommonJS, dotenv +
 * @prisma/client, DATABASE_URL read implicitly from env (never hardcoded).
 *
 * Idempotent: re-running wipes every business-data table (everything except
 * `app_messages`, which is the untouched system message catalog) in
 * FK-safe (children-before-parents) order, then re-seeds from scratch.
 *
 * Usage:
 *   node scripts/seed-realistic-clinic.js
 */

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ── Production conventions (mirrored from src/, see report) ──────────────
// src/domain/value-objects/password-policy.vo.ts
const BCRYPT_ROUNDS = 10;
const DEFAULT_STAFF_PASSWORD = 'Staff@123';
const DEFAULT_PATIENT_PASSWORD = 'Patient@123';

// src/domain/services/clinic-calendar.util.ts — appointmentTime/workDate/etc.
// are stored as Vietnam wall-clock values "labeled UTC" (no real timezone
// shift applied), so getUTC*() getters on a stored value already read as
// Vietnam local time. Replicated inline here rather than importing the
// compiled TS util, to keep this a dependency-free standalone script (see
// task instructions) — must stay in sync if that util's convention changes.
const CLINIC_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
function nowAsClinicNaiveUtc() {
  return new Date(Date.now() + CLINIC_UTC_OFFSET_MS);
}
function clinicDate(y, m, d, h = 0, mi = 0) {
  // m is 1-indexed here (calendar month), unlike Date.UTC's 0-indexed month.
  return new Date(Date.UTC(y, m - 1, d, h, mi, 0, 0));
}
function addDays(clinicNaiveDate, n) {
  return new Date(
    Date.UTC(
      clinicNaiveDate.getUTCFullYear(),
      clinicNaiveDate.getUTCMonth(),
      clinicNaiveDate.getUTCDate() + n,
    ),
  );
}
function addMinutes(date, n) {
  return new Date(date.getTime() + n * 60000);
}
function ymdKey(date) {
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}
function ymdParts(date) {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

// ── Random helpers ────────────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pickWeighted(pairs) {
  // pairs: [[value, weight], ...]
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}
function pickDistinct(arr, count) {
  const copy = [...arr];
  const out = [];
  count = Math.min(count, copy.length);
  for (let i = 0; i < count; i += 1) {
    const idx = randInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

// ── Vietnamese name generation ────────────────────────────────────────────
const LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý',
];
const MALE_MIDDLE = ['Văn', 'Hữu', 'Minh', 'Quang', 'Đức', 'Thành', 'Công', 'Anh', 'Tuấn', 'Trọng'];
const FEMALE_MIDDLE = ['Thị', 'Thị Minh', 'Thị Thu', 'Thị Ngọc', 'Thị Kim', 'Thị Hồng', 'Thị Thanh'];
const MALE_FIRST = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hải', 'Hùng', 'Khang', 'Long',
  'Minh', 'Nam', 'Phong', 'Quân', 'Sơn', 'Thắng', 'Tuấn', 'Việt', 'Vinh', 'Đăng',
];
const FEMALE_FIRST = [
  'Anh', 'Chi', 'Diệp', 'Giang', 'Hà', 'Hoa', 'Hương', 'Lan', 'Linh', 'Mai',
  'Ngân', 'Nga', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Trang', 'Vân', 'Yến',
];

function randomGender() {
  return pickWeighted([
    ['MALE', 48],
    ['FEMALE', 48],
    ['OTHER', 4],
  ]);
}
function randomVietnameseName(gender) {
  const last = pick(LAST_NAMES);
  const isFemale = gender === 'FEMALE';
  const middle = isFemale ? pick(FEMALE_MIDDLE) : pick(MALE_MIDDLE);
  const first = isFemale ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
  return `${last} ${middle} ${first}`;
}
function toAscii(str) {
  // Strip Unicode combining diacritical marks (U+0300-U+036F) left behind by
  // NFD normalization, without embedding literal combining characters in a
  // regex literal (fragile across editors/encodings) — filter by code point
  // instead.
  const decomposed = str.normalize('NFD');
  let out = '';
  for (const ch of decomposed) {
    const code = ch.codePointAt(0);
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += ch;
  }
  return out.replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function slugify(str) {
  return toAscii(str).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ── Unique-value counters (guarantee uniqueness within a single run) ─────
let phoneSeq = 0;
function nextPhone() {
  phoneSeq += 1;
  return '09' + String(10000000 + phoneSeq).slice(-8);
}
let idCardSeq = 0;
function nextIdCard() {
  idCardSeq += 1;
  return '079' + String(idCardSeq).padStart(9, '0');
}
let emailSeq = 0;
function nextEmail(fullName) {
  emailSeq += 1;
  return `${slugify(fullName)}.${emailSeq}@clinic.vn`;
}
// Staff accounts get the clinic's real domain; patients keep a generic one
// (nextEmail above) since a self-registered patient's email is personal,
// not clinic-issued.
let staffEmailSeq = 0;
function nextStaffEmail(fullName) {
  staffEmailSeq += 1;
  return `${slugify(fullName)}.${staffEmailSeq}@aucophuha.vn`;
}
let patientCodeSeq = 0;
// Format mirrors src/domain/value-objects/patient-code.vo.ts (BN-YYYYMMDD-XXXX)
// but uses a monotonic counter instead of Math.random() for the last segment
// to guarantee uniqueness across ~70 patients without a retry loop.
function nextPatientCode(date) {
  patientCodeSeq += 1;
  const { y, m, d } = ymdParts(date);
  return `BN-${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}-${String(patientCodeSeq).padStart(4, '0')}`;
}
let invoiceCodeSeq = 0;
// Format mirrors src/domain/value-objects/invoice-code.vo.ts (INV-YYYYMMDD-XXXX).
function nextInvoiceCode(date) {
  invoiceCodeSeq += 1;
  const { y, m, d } = ymdParts(date);
  return `INV-${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}-${String(invoiceCodeSeq).padStart(4, '0')}`;
}
// Mirrors the *actual* generateAccessCode() in
// src/application/use-cases/visits/create-examination-result.use-case.ts —
// a flat 10-char alphanumeric code with NO "KQ-" prefix/dashes. This is
// narrower than AccessCode.create()'s regex (`^KQ-[A-Z0-9]{2,}-[A-Z0-9]{4,}$`,
// matching the older database/seed.sql fixture), but the production
// use-case never runs its own output through that VO's validator, so this
// is what actually ends up stored in examination_results.access_code today
// (see report for this discrepancy).
function generateAccessCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i += 1) code += chars[randInt(0, chars.length - 1)];
  return code;
}

// ── Static reference data ─────────────────────────────────────────────────
// Specialty list reused verbatim from database/seed.sql (already vetted as
// canonical for this project).
const SPECIALTY_DEFS = [
  { key: 'noi', name: 'Chuyên khoa Nội', description: 'Khám và điều trị các bệnh lý nội khoa tổng quát' },
  { key: 'tmh', name: 'Tai Mũi Họng', description: null },
  { key: 'san', name: 'Sản phụ khoa', description: null },
  { key: 'tdcn', name: 'Thăm dò chức năng', description: null },
  { key: 'ngoai', name: 'Chuyên khoa ngoại', description: null },
  { key: 'mat', name: 'Chuyên khoa mắt', description: null },
  { key: 'rhm', name: 'Chuyên khoa Răng Hàm Mặt', description: null },
  { key: 'cdha', name: 'Chẩn đoán hình ảnh', description: 'Phòng X-quang, siêu âm' },
  { key: 'xn', name: 'Xét nghiệm', description: 'Phòng xét nghiệm cận lâm sàng' },
];

const EXAM_ROOM_NAME = {
  noi: 'Phòng khám Nội',
  tmh: 'Phòng khám Tai Mũi Họng',
  san: 'Phòng khám Sản',
  tdcn: 'Phòng Thăm dò chức năng',
  ngoai: 'Phòng khám Ngoại',
  mat: 'Phòng khám Mắt',
  rhm: 'Phòng khám Răng Hàm Mặt',
  cdha: 'Phòng tư vấn Chẩn đoán hình ảnh',
  xn: 'Phòng tư vấn Xét nghiệm',
};

const CLS_ROOM_DEFS = [
  { code: 'CLS-01', name: 'Phòng Xét nghiệm', category: 'LAB', specialtyKey: 'xn', description: 'Phòng thực hiện xét nghiệm máu và sinh hóa cơ bản' },
  { code: 'CLS-02', name: 'Phòng X-quang', category: 'XRAY', specialtyKey: 'cdha', description: 'Phòng chụp X-quang kỹ thuật số' },
  { code: 'CLS-03', name: 'Phòng Siêu âm', category: 'ULTRASOUND', specialtyKey: 'cdha', description: 'Phòng siêu âm tổng quát' },
  { code: 'CLS-04', name: 'Phòng Điện tim', category: 'ECG', specialtyKey: 'tdcn', description: 'Phòng đo điện tâm đồ' },
];

const EXAM_SERVICES_PLAN = {
  noi: [
    { name: 'Khám Nội tổng quát', price: 150000 },
    { name: 'Khám Tim mạch', price: 180000 },
    { name: 'Khám Tiêu hóa', price: 170000 },
  ],
  tmh: [
    { name: 'Khám Tai Mũi Họng', price: 150000 },
    { name: 'Nội soi Tai Mũi Họng', price: 220000 },
  ],
  san: [
    { name: 'Khám Sản phụ khoa', price: 180000 },
    { name: 'Khám thai định kỳ', price: 200000 },
  ],
  tdcn: [
    { name: 'Khám Thăm dò chức năng', price: 160000 },
    { name: 'Tư vấn Hô hấp', price: 150000 },
  ],
  ngoai: [
    { name: 'Khám Ngoại tổng quát', price: 150000 },
    { name: 'Khám Chấn thương chỉnh hình', price: 200000 },
  ],
  mat: [
    { name: 'Khám Mắt', price: 150000 },
    { name: 'Đo thị lực - Khúc xạ', price: 120000 },
  ],
  rhm: [
    { name: 'Khám Răng Hàm Mặt', price: 150000 },
    { name: 'Tư vấn nhổ răng', price: 130000 },
  ],
  cdha: [
    { name: 'Khám tư vấn Chẩn đoán hình ảnh', price: 100000 },
    { name: 'Hội chẩn hình ảnh chuyên sâu', price: 150000 },
  ],
  xn: [
    { name: 'Khám tư vấn Xét nghiệm', price: 100000 },
    { name: 'Tư vấn kết quả xét nghiệm chuyên sâu', price: 130000 },
  ],
};

const CLS_SERVICES_PLAN = {
  LAB: [
    { name: 'Tổng phân tích tế bào máu (CBC)', price: 120000 },
    { name: 'Sinh hóa máu cơ bản', price: 200000 },
    { name: 'Xét nghiệm đường huyết', price: 60000 },
    { name: 'Xét nghiệm mỡ máu (Lipid máu)', price: 150000 },
    { name: 'Xét nghiệm chức năng gan (AST/ALT)', price: 130000 },
    { name: 'Xét nghiệm chức năng thận (Ure/Creatinin)', price: 130000 },
  ],
  XRAY: [
    { name: 'Chụp X-quang ngực thẳng', price: 150000 },
    { name: 'Chụp X-quang cột sống', price: 220000 },
  ],
  ULTRASOUND: [
    { name: 'Siêu âm ổ bụng tổng quát', price: 250000 },
    { name: 'Siêu âm tuyến giáp', price: 200000 },
  ],
  ECG: [
    { name: 'Đo điện tim thường quy', price: 100000 },
  ],
};

const DOCTOR_PLAN = [
  { specialtyKey: 'noi', count: 2 },
  { specialtyKey: 'tmh', count: 1 },
  { specialtyKey: 'san', count: 1 },
  { specialtyKey: 'tdcn', count: 1 },
  { specialtyKey: 'ngoai', count: 1 },
  { specialtyKey: 'mat', count: 1 },
  { specialtyKey: 'rhm', count: 1 },
  { specialtyKey: 'cdha', count: 1 },
  { specialtyKey: 'xn', count: 1 },
];
const NURSE_SPECIALTY_KEYS = ['noi', 'san', 'ngoai'];
const LAB_TECH_PLAN = [
  { roomCode: 'CLS-01', specialtyKey: 'xn' },
  { roomCode: 'CLS-02', specialtyKey: 'cdha' },
  { roomCode: 'CLS-03', specialtyKey: 'cdha' },
  { roomCode: 'CLS-04', specialtyKey: 'tdcn' },
];

const DEGREES = ['Bác sĩ', 'Bác sĩ CKI', 'Bác sĩ CKII', 'Thạc sĩ Y khoa', 'Tiến sĩ Y khoa'];

const MEDICINES = [
  // Reused verbatim from database/seed.sql (real production catalog).
  { name: 'Paracetamol 500mg', activeIngredient: 'Paracetamol', dosageForm: 'Viên nén', unit: 'VIEN', price: 2000, contraindications: 'Suy gan nặng, dị ứng paracetamol' },
  { name: 'Amoxicillin 500mg', activeIngredient: 'Amoxicillin', dosageForm: 'Viên nang', unit: 'VIEN', price: 5000, contraindications: 'Dị ứng Penicillin' },
  { name: 'Ibuprofen 400mg', activeIngredient: 'Ibuprofen', dosageForm: 'Viên nén', unit: 'VIEN', price: 3000, contraindications: 'Loét dạ dày, suy thận' },
  { name: 'Omeprazole 20mg', activeIngredient: 'Omeprazole', dosageForm: 'Viên nang', unit: 'VIEN', price: 8000, contraindications: 'Không dùng chung với Clopidogrel' },
  { name: 'Vitamin C 500mg', activeIngredient: 'Ascorbic Acid', dosageForm: 'Viên sủi', unit: 'VIEN', price: 1500, contraindications: null },
  { name: 'Metformin 500mg', activeIngredient: 'Metformin HCl', dosageForm: 'Viên nén', unit: 'VIEN', price: 4000, contraindications: 'Suy thận, suy gan, nhiễm toan lactic' },
  { name: 'Cetirizine 10mg', activeIngredient: 'Cetirizine HCl', dosageForm: 'Viên nén', unit: 'VIEN', price: 3500, contraindications: 'Mẫn cảm với Hydroxyzine' },
  { name: 'Alpha Chymotrypsin 4200 đơn vị', activeIngredient: 'Alpha Chymotrypsin', dosageForm: 'Viên nén', unit: 'VIEN', price: 1500, contraindications: 'Rối loạn đông máu' },
  { name: 'Amlodipine 5mg', activeIngredient: 'Amlodipine', dosageForm: 'Viên nén', unit: 'VIEN', price: 3000, contraindications: 'Hạ huyết áp nặng, sốc tim' },
  { name: 'Antacid nhôm-magie', activeIngredient: 'Nhôm hydroxit, Magie hydroxit', dosageForm: 'Gói hỗn dịch', unit: 'GOI', price: 3500, contraindications: 'Suy thận nặng' },
  { name: 'Atorvastatin 10mg', activeIngredient: 'Atorvastatin', dosageForm: 'Viên nén', unit: 'VIEN', price: 4000, contraindications: 'Bệnh gan hoạt động, phụ nữ có thai' },
  { name: 'Azithromycin 250mg', activeIngredient: 'Azithromycin', dosageForm: 'Viên nén', unit: 'VIEN', price: 8000, contraindications: 'Suy gan nặng' },
  { name: 'Betahistine 16mg', activeIngredient: 'Betahistine', dosageForm: 'Viên nén', unit: 'VIEN', price: 2500, contraindications: 'U tủy thượng thận (Pheochromocytoma)' },
  { name: 'Betamethasone + Clotrimazole kem', activeIngredient: 'Betamethasone, Clotrimazole', dosageForm: 'Tuýp kem bôi', unit: 'TUYP', price: 30000, contraindications: 'Nhiễm virus/nấm da chưa xác định' },
  { name: 'Bromhexine 8mg', activeIngredient: 'Bromhexine HCl', dosageForm: 'Viên nén', unit: 'VIEN', price: 1500, contraindications: 'Loét dạ dày tá tràng' },
  { name: 'Calci + Vitamin D3', activeIngredient: 'Calci carbonat, Cholecalciferol', dosageForm: 'Viên sủi', unit: 'VIEN', price: 2500, contraindications: 'Tăng calci máu, sỏi thận calci' },
  { name: 'Cefuroxime 500mg', activeIngredient: 'Cefuroxime axetil', dosageForm: 'Viên nén', unit: 'VIEN', price: 12000, contraindications: 'Dị ứng Cephalosporin' },
  { name: 'Cephalexin 500mg', activeIngredient: 'Cephalexin', dosageForm: 'Viên nang', unit: 'VIEN', price: 4500, contraindications: 'Dị ứng Cephalosporin' },
  { name: 'Dextromethorphan 15mg', activeIngredient: 'Dextromethorphan', dosageForm: 'Viên nén', unit: 'VIEN', price: 1500, contraindications: 'Đang dùng thuốc ức chế MAO' },
  { name: 'Diclofenac gel', activeIngredient: 'Diclofenac', dosageForm: 'Tuýp gel bôi', unit: 'TUYP', price: 25000, contraindications: 'Vết thương hở' },
  { name: 'Domperidone 10mg', activeIngredient: 'Domperidone', dosageForm: 'Viên nén', unit: 'VIEN', price: 2000, contraindications: 'Xuất huyết tiêu hóa, bệnh tim nặng' },
  { name: 'Doxycycline 100mg', activeIngredient: 'Doxycycline', dosageForm: 'Viên nang', unit: 'VIEN', price: 3000, contraindications: 'Phụ nữ có thai, trẻ dưới 8 tuổi' },
  { name: 'Esomeprazole 40mg', activeIngredient: 'Esomeprazole', dosageForm: 'Viên nang', unit: 'VIEN', price: 9000, contraindications: 'Dùng chung với Rilpivirine' },
  { name: 'Gliclazide 80mg', activeIngredient: 'Gliclazide', dosageForm: 'Viên nén', unit: 'VIEN', price: 3000, contraindications: 'Đái tháo đường type 1, suy thận nặng' },
  { name: 'Loperamide 2mg', activeIngredient: 'Loperamide', dosageForm: 'Viên nang', unit: 'VIEN', price: 2500, contraindications: 'Tiêu chảy nhiễm khuẩn có sốt' },
  { name: 'Loratadine 10mg', activeIngredient: 'Loratadine', dosageForm: 'Viên nén', unit: 'VIEN', price: 3000, contraindications: null },
  { name: 'Losartan 50mg', activeIngredient: 'Losartan Kali', dosageForm: 'Viên nén', unit: 'VIEN', price: 3500, contraindications: 'Phụ nữ có thai' },
  { name: 'Natri Clorid 0.9% nhỏ mắt', activeIngredient: 'Natri Clorid', dosageForm: 'Chai nhỏ mắt', unit: 'CHAI', price: 8000, contraindications: null },
  { name: 'Oresol (ORS)', activeIngredient: 'Muối bù nước điện giải', dosageForm: 'Gói bột pha', unit: 'GOI', price: 3000, contraindications: 'Tắc ruột' },
  { name: 'Povidone-iodine 10%', activeIngredient: 'Povidone-iodine', dosageForm: 'Chai dung dịch', unit: 'CHAI', price: 20000, contraindications: 'Cường giáp, dị ứng iod' },
  { name: 'Prednisolone 5mg', activeIngredient: 'Prednisolone', dosageForm: 'Viên nén', unit: 'VIEN', price: 1000, contraindications: 'Nhiễm nấm toàn thân, loét dạ dày tiến triển' },
  { name: 'Salbutamol xịt', activeIngredient: 'Salbutamol', dosageForm: 'Bình xịt định liều', unit: 'LO', price: 45000, contraindications: 'Rối loạn nhịp tim' },
  { name: 'Vitamin 3B', activeIngredient: 'Vitamin B1, B6, B12', dosageForm: 'Viên nén', unit: 'VIEN', price: 2000, contraindications: null },
  { name: 'Vitamin D3 1000IU', activeIngredient: 'Cholecalciferol', dosageForm: 'Viên nang', unit: 'VIEN', price: 2000, contraindications: 'Tăng calci máu' },
  // New additions to round out the ~40-item catalog (giảm đau/kháng
  // sinh/tiêu hóa/tim mạch/tiểu đường/vitamin already covered above).
  { name: 'Clopidogrel 75mg', activeIngredient: 'Clopidogrel', dosageForm: 'Viên nén', unit: 'VIEN', price: 5000, contraindications: 'Xuất huyết đang tiến triển, loét dạ dày tá tràng' },
  { name: 'Rosuvastatin 10mg', activeIngredient: 'Rosuvastatin', dosageForm: 'Viên nén', unit: 'VIEN', price: 6000, contraindications: 'Bệnh gan hoạt động' },
  { name: 'Insulin Glargine (Lantus)', activeIngredient: 'Insulin Glargine', dosageForm: 'Bút tiêm', unit: 'ONG', price: 350000, contraindications: 'Hạ đường huyết' },
  { name: 'Berberin 100mg', activeIngredient: 'Berberin', dosageForm: 'Viên nén', unit: 'VIEN', price: 1000, contraindications: 'Phụ nữ có thai 3 tháng đầu' },
  { name: 'Simethicone 80mg', activeIngredient: 'Simethicone', dosageForm: 'Viên nang', unit: 'VIEN', price: 2000, contraindications: null },
  { name: 'Vitamin B12 1000mcg', activeIngredient: 'Cyanocobalamin', dosageForm: 'Viên nén', unit: 'VIEN', price: 2500, contraindications: null },
];

const SUPPLY_CATEGORY_DEFS = [
  { key: 'tieu_hao', name: 'Vật tư tiêu hao', description: 'Kim tiêm, bông, gạc, găng tay...' },
  { key: 'thiet_bi', name: 'Thiết bị y tế', description: 'Máy đo huyết áp, nhiệt kế...' },
  { key: 'hoa_chat', name: 'Hóa chất xét nghiệm', description: 'Reagent, hóa chất phân tích...' },
  { key: 'nha_khoa', name: 'Vật tư nha khoa', description: 'Vật tư dùng cho phòng khám Răng Hàm Mặt' },
  { key: 'san_khoa', name: 'Vật tư sản khoa', description: 'Vật tư dùng cho phòng khám Sản phụ khoa' },
  { key: 'van_phong', name: 'Văn phòng phẩm y tế', description: 'Sổ sách, giấy in phục vụ khám chữa bệnh' },
];

const SUPPLY_DEFS = [
  { name: 'Kim tiêm 5ml', categoryKey: 'tieu_hao', unit: 'CAI', minStockLevel: 100 },
  { name: 'Bơm tiêm 5ml', categoryKey: 'tieu_hao', unit: 'CAI', minStockLevel: 100 },
  { name: 'Bơm tiêm 10ml', categoryKey: 'tieu_hao', unit: 'CAI', minStockLevel: 100 },
  { name: 'Găng tay y tế size S', categoryKey: 'tieu_hao', unit: 'KHAC', minStockLevel: 100 },
  { name: 'Găng tay y tế size M', categoryKey: 'tieu_hao', unit: 'KHAC', minStockLevel: 100 },
  { name: 'Găng tay y tế size L', categoryKey: 'tieu_hao', unit: 'KHAC', minStockLevel: 100 },
  { name: 'Khẩu trang y tế', categoryKey: 'tieu_hao', unit: 'HOP', minStockLevel: 20 },
  { name: 'Bông y tế', categoryKey: 'tieu_hao', unit: 'HOP', minStockLevel: 20 },
  { name: 'Băng gạc cuộn', categoryKey: 'tieu_hao', unit: 'CAI', minStockLevel: 20 },
  { name: 'Băng dính y tế', categoryKey: 'tieu_hao', unit: 'CAI', minStockLevel: 20 },
  { name: 'Máy đo huyết áp', categoryKey: 'thiet_bi', unit: 'CAI', minStockLevel: 2 },
  { name: 'Nhiệt kế điện tử', categoryKey: 'thiet_bi', unit: 'CAI', minStockLevel: 5 },
  { name: 'Ống nghe y tế', categoryKey: 'thiet_bi', unit: 'CAI', minStockLevel: 2 },
  { name: 'Máy đo SpO2 kẹp ngón tay', categoryKey: 'thiet_bi', unit: 'CAI', minStockLevel: 3 },
  { name: 'Reagent CBC', categoryKey: 'hoa_chat', unit: 'BO', minStockLevel: 5 },
  { name: 'Ống nghiệm xét nghiệm máu (EDTA)', categoryKey: 'hoa_chat', unit: 'HOP', minStockLevel: 20 },
  { name: 'Que test đường huyết nhanh', categoryKey: 'hoa_chat', unit: 'HOP', minStockLevel: 10 },
  { name: 'Que test nhanh Covid-19', categoryKey: 'hoa_chat', unit: 'HOP', minStockLevel: 10 },
  { name: 'Kim gây tê nha khoa', categoryKey: 'nha_khoa', unit: 'CAI', minStockLevel: 30 },
  { name: 'Vật liệu trám răng Composite', categoryKey: 'nha_khoa', unit: 'BO', minStockLevel: 5 },
  { name: 'Chỉ nha khoa y tế', categoryKey: 'nha_khoa', unit: 'HOP', minStockLevel: 10 },
  { name: 'Bộ dụng cụ khám phụ khoa', categoryKey: 'san_khoa', unit: 'BO', minStockLevel: 5 },
  { name: 'Gel siêu âm sản khoa', categoryKey: 'san_khoa', unit: 'CHAI', minStockLevel: 5 },
  { name: 'Sổ khám bệnh', categoryKey: 'van_phong', unit: 'CAI', minStockLevel: 20 },
  { name: 'Giấy in kết quả xét nghiệm', categoryKey: 'van_phong', unit: 'HOP', minStockLevel: 10 },
];

const SUPPLIER_DEFS = [
  { name: 'Công ty TNHH Medipharco', phone: '02838001234', email: 'order@medipharco.vn', address: '123 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM' },
  { name: 'Công ty CP Thiết Bị Y Tế VN', phone: '02839005678', email: 'sales@meddevice.vn', address: '456 Hoàng Văn Thụ, Q.Phú Nhuận, TP.HCM' },
  { name: 'Công ty CP Dược phẩm Trung ương', phone: '02439001122', email: 'contact@duocpham-tw.vn', address: '89 Láng Hạ, Q.Đống Đa, Hà Nội' },
  { name: 'Công ty TNHH Vật tư Y tế Sài Gòn', phone: '02838887777', email: 'info@vattuytesg.vn', address: '210 Cách Mạng Tháng 8, Q.10, TP.HCM' },
];

const DIAGNOSES = {
  noi: ['Viêm dạ dày cấp tính', 'Tăng huyết áp chưa kiểm soát', 'Rối loạn tiêu hóa chức năng', 'Viêm phế quản cấp', 'Đái tháo đường type 2 mới phát hiện', 'Rối loạn lipid máu'],
  tmh: ['Viêm mũi họng cấp', 'Viêm amidan cấp', 'Viêm xoang mạn tính đợt cấp', 'Viêm tai giữa cấp'],
  san: ['Khám thai định kỳ 3 tháng giữa', 'Viêm âm đạo do nấm Candida', 'Rối loạn kinh nguyệt cơ năng'],
  tdcn: ['Rối loạn chức năng hô hấp nhẹ', 'Hen phế quản kiểm soát một phần', 'Khó thở cần theo dõi thêm'],
  ngoai: ['Vết thương phần mềm đang lành', 'Thoát vị bẹn nghi ngờ, cần theo dõi', 'Viêm mô tế bào nhẹ chi dưới'],
  mat: ['Viêm kết mạc dị ứng', 'Tật khúc xạ cận thị', 'Khô mắt mạn tính'],
  rhm: ['Sâu răng số 6 hàm dưới', 'Viêm nướu răng', 'Viêm tủy răng cấp'],
  cdha: ['Cần chụp X-quang kiểm tra thêm', 'Kết quả hình ảnh học trong giới hạn bình thường'],
  xn: ['Chỉ số xét nghiệm trong giới hạn bình thường', 'Cần theo dõi thêm chỉ số đường huyết'],
};

const ADDRESS_POOL = [
  '12 Lê Lợi, Q.1, TP.HCM', '45 Nguyễn Huệ, Q.1, TP.HCM', '78 Trần Hưng Đạo, Q.5, TP.HCM',
  '23 Cách Mạng Tháng 8, Q.3, TP.HCM', '56 Võ Văn Tần, Q.3, TP.HCM', '88 Nguyễn Thị Minh Khai, Q.3, TP.HCM',
  '34 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM', '67 Phan Xích Long, Q.Phú Nhuận, TP.HCM',
  '15 Nguyễn Văn Cừ, Q.5, TP.HCM', '102 Hai Bà Trưng, Q.1, TP.HCM', '9 Lý Thường Kiệt, Q.10, TP.HCM',
  '221 Lạc Long Quân, Q.Tân Bình, TP.HCM', '5 Hoàng Diệu, Q.4, TP.HCM', '77 Trường Chinh, Q.Tân Bình, TP.HCM',
  '150 Nguyễn Trãi, Q.5, TP.HCM',
];
const ALLERGEN_POOL = ['Penicillin', 'Aspirin', 'Sulfonamide', 'Phấn hoa', 'Hải sản (tôm, cua)', 'Lông động vật', 'Iod cản quang'];
const CANCEL_REASONS = [
  'Bệnh nhân bận công việc đột xuất',
  'Bệnh nhân bị ốm không thể đến khám',
  'Bệnh nhân xin đổi lịch sang ngày khác',
  'Bệnh nhân không phản hồi xác nhận lịch hẹn',
];
const APPT_NOTE_POOL = [null, null, null, 'Đau bụng 2 ngày nay', 'Tái khám theo hẹn', 'Ho, sốt nhẹ 3 ngày', 'Khám sức khỏe định kỳ'];
const DOSAGES = ['1 viên', '2 viên', '500mg', '1 gói', '1 tuýp bôi ngoài da', '5ml', '10ml'];
const FREQUENCIES = ['1 lần/ngày', '2 lần/ngày', '3 lần/ngày', 'Khi cần (đau)', 'Sáng - Tối'];
const INSTRUCTIONS = ['Uống sau ăn', 'Uống trước ăn 30 phút', 'Uống nhiều nước', 'Bôi ngoài da vùng tổn thương, tránh mắt', 'Không dùng quá 7 ngày liên tục'];

// ── Vital signs / CLS result generators ───────────────────────────────────
function getAge(dob, atDate) {
  let age = atDate.getUTCFullYear() - dob.getUTCFullYear();
  const m = atDate.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && atDate.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}
function buildVitalSigns(age) {
  let systolic, diastolic, hr, weight, height;
  if (age < 12) {
    systolic = randInt(90, 110); diastolic = randInt(55, 70); hr = randInt(80, 120);
    weight = Number((randInt(15, 40) + Math.random()).toFixed(1));
    height = randInt(90, 150);
  } else if (age >= 65) {
    systolic = randInt(110, 150); diastolic = randInt(65, 95); hr = randInt(60, 95);
    weight = Number((randInt(45, 75) + Math.random()).toFixed(1));
    height = randInt(145, 175);
  } else {
    systolic = randInt(100, 135); diastolic = randInt(60, 88); hr = randInt(65, 100);
    weight = Number((randInt(45, 85) + Math.random()).toFixed(1));
    height = randInt(150, 185);
  }
  const temperature = Number((36 + Math.random() * 1.5).toFixed(1));
  const spo2 = randInt(95, 99);
  return { systolicBp: systolic, diastolicBp: diastolic, heartRate: hr, temperature, spo2, weight, height };
}
function buildClsResultData(category) {
  switch (category) {
    case 'LAB':
      return {
        data: {
          WBC: Number((randInt(45, 100) / 10).toFixed(1)),
          RBC: Number((randInt(38, 55) / 10).toFixed(1)),
          HGB: Number((randInt(110, 160) / 10).toFixed(1)),
          HCT: Number((randInt(350, 480) / 10).toFixed(1)),
          PLT: randInt(180, 400),
          glucose: Number((randInt(40, 70) / 10).toFixed(1)),
        },
        summary: pick(['Kết quả trong giới hạn bình thường.', 'Một vài chỉ số cao nhẹ, cần theo dõi thêm.', 'Không phát hiện bất thường đáng kể.']),
      };
    case 'XRAY':
      return {
        data: { finding: pick(['Không phát hiện bất thường.', 'Hình ảnh thâm nhiễm nhẹ đáy phổi phải.', 'Cấu trúc xương trong giới hạn bình thường.']) },
        summary: pick(['Kết quả X-quang bình thường.', 'Cần theo dõi thêm, tái chụp nếu triệu chứng kéo dài.']),
      };
    case 'ULTRASOUND':
      return {
        data: { finding: pick(['Gan, mật, tụy, lách, thận trong giới hạn bình thường.', 'Có nang nhỏ gan phải, kích thước dưới 1cm, lành tính.', 'Tuyến giáp echo đều, không phát hiện nhân.']) },
        summary: pick(['Siêu âm không phát hiện bất thường.', 'Cần siêu âm kiểm tra lại sau 3-6 tháng.']),
      };
    case 'ECG':
    default:
      return {
        data: { rhythm: 'Nhịp xoang đều', rate: randInt(65, 95), finding: pick(['Không phát hiện bất thường.', 'Trục điện tim bình thường.']) },
        summary: 'Điện tâm đồ trong giới hạn bình thường.',
      };
  }
}
function computePriority(patient, todayDate) {
  const age = getAge(patient.dateOfBirth, todayDate);
  if (Math.random() < 0.03) return 'EMERGENCY';
  if (age <= 12) return 'CHILD';
  if (age >= 65) return 'ELDERLY';
  if (patient.gender === 'FEMALE' && age >= 18 && age <= 45 && Math.random() < 0.15) return 'PREGNANT';
  return 'NORMAL';
}
function randomTimeInShift(shift) {
  const minute = pick([0, 15, 30, 45]);
  if (shift === 'MORNING') return { hour: randInt(7, 11), minute };
  let hour = randInt(13, 16);
  let mi = minute;
  if (hour === 16 && mi > 30) mi = 30;
  return { hour, minute: mi };
}

// ── Bulk-insert helper (chunked createMany, FK-order aware) ──────────────
async function insertMany(model, rows, chunkSize = 500) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await model.createMany({ data: rows.slice(i, i + chunkSize), skipDuplicates: true });
  }
}

// ── Idempotency: wipe every business-data table (children before parents),
// leaving app_messages untouched. ───────────────────────────────────────
async function deleteAllBusinessData() {
  console.log('Wiping existing business data (app_messages untouched)...');
  const steps = [
    ['ai_chat_logs', () => prisma.aiChatLog.deleteMany({})],
    ['system_logs', () => prisma.systemLog.deleteMany({})],
    ['notification_logs', () => prisma.notificationLog.deleteMany({})],
    ['invoice_payment_items', () => prisma.invoicePaymentItem.deleteMany({})],
    ['invoice_payments', () => prisma.invoicePayment.deleteMany({})],
    ['invoice_items', () => prisma.invoiceItem.deleteMany({})],
    ['invoices', () => prisma.invoice.deleteMany({})],
    ['prescription_items', () => prisma.prescriptionItem.deleteMany({})],
    ['prescriptions', () => prisma.prescription.deleteMany({})],
    ['cls_attachments', () => prisma.clsAttachment.deleteMany({})],
    ['cls_results', () => prisma.clsResult.deleteMany({})],
    ['cls_orders', () => prisma.clsOrder.deleteMany({})],
    ['examination_results', () => prisma.examinationResult.deleteMany({})],
    ['vital_signs', () => prisma.vitalSigns.deleteMany({})],
    ['visits', () => prisma.visit.deleteMany({})],
    ['appointment_history', () => prisma.appointmentHistory.deleteMany({})],
    ['appointments', () => prisma.appointment.deleteMany({})],
    ['medical_records', () => prisma.medicalRecord.deleteMany({})],
    ['patient_allergies', () => prisma.patientAllergy.deleteMany({})],
    ['patients', () => prisma.patient.deleteMany({})],
    ['supply_transactions', () => prisma.supplyTransaction.deleteMany({})],
    ['supply_import_items', () => prisma.supplyImportItem.deleteMany({})],
    ['supply_imports', () => prisma.supplyImport.deleteMany({})],
    ['supplies', () => prisma.supply.deleteMany({})],
    ['suppliers', () => prisma.supplier.deleteMany({})],
    ['supply_categories', () => prisma.supplyCategory.deleteMany({})],
    ['work_schedules', () => prisma.workSchedule.deleteMany({})],
    ['doctor_certification_files', () => prisma.doctorCertificationFile.deleteMany({})],
    ['doctor_profile_pending_updates', () => prisma.doctorProfilePendingUpdate.deleteMany({})],
    ['doctor_profiles', () => prisma.doctorProfile.deleteMany({})],
    ['refresh_tokens', () => prisma.refreshToken.deleteMany({})],
    ['otp_tokens', () => prisma.otpToken.deleteMany({})],
    ['medicines', () => prisma.medicine.deleteMany({})],
    ['users', () => prisma.user.deleteMany({})],
    ['services', () => prisma.service.deleteMany({})],
    ['rooms', () => prisma.room.deleteMany({})],
    ['specialties', () => prisma.specialty.deleteMany({})],
  ];
  for (const [label, fn] of steps) {
    const result = await fn();
    console.log(`  cleared ${label} (${result.count})`);
  }
}

async function main() {
  console.log('='.repeat(78));
  console.log('  SEED REALISTIC CLINIC DATASET');
  console.log('='.repeat(78));

  await deleteAllBusinessData();

  const staffPasswordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, BCRYPT_ROUNDS);
  const patientPasswordHash = await bcrypt.hash(DEFAULT_PATIENT_PASSWORD, BCRYPT_ROUNDS);

  const today = nowAsClinicNaiveUtc();
  const todayDateOnly = clinicDate(ymdParts(today).y, ymdParts(today).m, ymdParts(today).d);

  // ── 1. Specialties ───────────────────────────────────────────────────
  console.log('\nSeeding specialties...');
  const specialties = SPECIALTY_DEFS.map((s) => ({ id: uuid(), ...s }));
  const specialtyByKey = Object.fromEntries(specialties.map((s) => [s.key, s]));
  await insertMany(prisma.specialty, specialties.map((s) => ({ id: s.id, name: s.name, description: s.description })));
  console.log(`  ${specialties.length} specialties`);

  // ── 2. Rooms ──────────────────────────────────────────────────────────
  console.log('Seeding rooms...');
  const ADMIN_USER_PLACEHOLDER_ID = uuid(); // first admin id, created below; referenced by createdBy
  const examRooms = SPECIALTY_DEFS.map((s, idx) => ({
    id: uuid(),
    roomCode: `PK-${String(idx + 1).padStart(2, '0')}`,
    name: EXAM_ROOM_NAME[s.key],
    type: 'EXAMINATION',
    specialtyKey: s.key,
    specialtyId: specialtyByKey[s.key].id,
    clsCategory: null,
    description: null,
  }));
  const clsRooms = CLS_ROOM_DEFS.map((r) => ({
    id: uuid(),
    roomCode: r.code,
    name: r.name,
    type: 'CLS',
    specialtyKey: r.specialtyKey,
    specialtyId: specialtyByKey[r.specialtyKey].id,
    clsCategory: r.category,
    description: r.description,
  }));
  const adminRoom = {
    id: uuid(), roomCode: 'AD-01', name: 'Phòng hành chính', type: 'ADMIN',
    specialtyKey: null, specialtyId: null, clsCategory: null, description: 'Phòng quản lý và điều hành',
  };
  const allRooms = [...examRooms, ...clsRooms, adminRoom];
  const examRoomBySpecialtyKey = Object.fromEntries(examRooms.map((r) => [r.specialtyKey, r]));
  const clsRoomByCode = Object.fromEntries(clsRooms.map((r) => [r.roomCode, r]));
  const clsRoomByCategory = Object.fromEntries(clsRooms.map((r) => [r.clsCategory, r]));

  await insertMany(prisma.room, allRooms.map((r) => ({
    id: r.id, roomCode: r.roomCode, name: r.name, type: r.type, description: r.description,
    clsCategory: r.clsCategory, specialtyId: r.specialtyId, createdBy: ADMIN_USER_PLACEHOLDER_ID,
  })));
  console.log(`  ${allRooms.length} rooms (9 examination + 4 CLS + 1 admin)`);

  // ── 3. Services ───────────────────────────────────────────────────────
  console.log('Seeding services...');
  const examServices = [];
  for (const s of SPECIALTY_DEFS) {
    for (const svc of EXAM_SERVICES_PLAN[s.key]) {
      examServices.push({
        id: uuid(), name: svc.name, price: svc.price, type: 'EXAMINATION',
        clsCategory: null, specialtyId: specialtyByKey[s.key].id, specialtyKey: s.key,
      });
    }
  }
  const clsServices = [];
  for (const [category, list] of Object.entries(CLS_SERVICES_PLAN)) {
    const room = clsRoomByCategory[category];
    for (const svc of list) {
      clsServices.push({
        id: uuid(), name: svc.name, price: svc.price, type: 'CLS',
        clsCategory: category, specialtyId: room.specialtyId, category,
      });
    }
  }
  const allServices = [...examServices, ...clsServices];
  await insertMany(prisma.service, allServices.map((s) => ({
    id: s.id, name: s.name, specialtyId: s.specialtyId, type: s.type, clsCategory: s.clsCategory,
    price: s.price, createdBy: ADMIN_USER_PLACEHOLDER_ID,
  })));
  const examServicesBySpecialtyKey = {};
  for (const s of examServices) {
    (examServicesBySpecialtyKey[s.specialtyKey] ||= []).push(s);
  }
  const clsServicesByCategory = {};
  for (const s of clsServices) {
    (clsServicesByCategory[s.category] ||= []).push(s);
  }
  console.log(`  ${allServices.length} services (${examServices.length} examination + ${clsServices.length} CLS)`);

  // ── 4. Users (staff) ─────────────────────────────────────────────────
  console.log('Seeding staff users...');
  const users = [];
  const admins = [];
  const receptionists = [];
  const doctors = []; // { id, specialtyKey, roomId }
  const nurses = [];
  const labTechs = []; // { id, specialtyKey, roomId, category }
  const doctorProfiles = [];

  function makeStaffUser(role, specialtyId) {
    const gender = randomGender() === 'FEMALE' ? 'FEMALE' : 'MALE';
    const fullName = randomVietnameseName(gender);
    const id = uuid();
    const user = {
      id, fullName, email: nextStaffEmail(fullName), phone: nextPhone(), passwordHash: staffPasswordHash,
      role, specialtyId: specialtyId ?? null, mustChangePassword: true, createdBy: null,
    };
    users.push(user);
    return user;
  }

  // 2 ADMIN
  for (let i = 0; i < 2; i += 1) {
    const u = makeStaffUser('ADMIN', null);
    if (i === 0) u.id = ADMIN_USER_PLACEHOLDER_ID; // keep the pre-generated id used as createdBy above
    admins.push(u);
  }
  // 5 RECEPTIONIST
  for (let i = 0; i < 5; i += 1) receptionists.push(makeStaffUser('RECEPTIONIST', null));
  // 10 DOCTOR
  for (const plan of DOCTOR_PLAN) {
    for (let i = 0; i < plan.count; i += 1) {
      const specialty = specialtyByKey[plan.specialtyKey];
      const u = makeStaffUser('DOCTOR', specialty.id);
      const room = examRoomBySpecialtyKey[plan.specialtyKey];
      doctors.push({ id: u.id, fullName: u.fullName, specialtyKey: plan.specialtyKey, roomId: room.id, roomCode: room.roomCode });
      doctorProfiles.push({
        id: uuid(), userId: u.id, specialtyId: specialty.id, degree: pick(DEGREES),
        yearsExperience: randInt(3, 25),
        biography: `Bác sĩ chuyên khoa ${specialty.name} với nhiều năm kinh nghiệm khám và điều trị.`,
      });
    }
  }
  // 3 NURSE
  for (const key of NURSE_SPECIALTY_KEYS) {
    const u = makeStaffUser('NURSE', specialtyByKey[key].id);
    nurses.push({ id: u.id, specialtyKey: key });
  }
  // 4 LAB_TECH
  for (const plan of LAB_TECH_PLAN) {
    const specialty = specialtyByKey[plan.specialtyKey];
    const u = makeStaffUser('LAB_TECH', specialty.id);
    const room = clsRoomByCode[plan.roomCode];
    labTechs.push({ id: u.id, specialtyKey: plan.specialtyKey, roomId: room.id, category: room.clsCategory });
  }

  await insertMany(prisma.user, users.map((u) => ({
    id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, passwordHash: u.passwordHash,
    role: u.role, specialtyId: u.specialtyId, mustChangePassword: u.mustChangePassword, createdBy: u.createdBy,
  })));
  await insertMany(prisma.doctorProfile, doctorProfiles);
  console.log(`  ${users.length} staff users (2 ADMIN, 5 RECEPTIONIST, 10 DOCTOR, 3 NURSE, 4 LAB_TECH)`);
  console.log(`  ${doctorProfiles.length} doctor profiles`);

  // ── 5. Work schedules (recurring weekly MORNING+AFTERNOON, Mon-Sat) ───
  console.log('Seeding work schedules...');
  const PAST_DAYS_BACK = 35;
  // Coordinator correction (2026-09-07): keep the near-future appointment
  // slice to only 2 days ahead of "today" (whatever "today" is at run
  // time) — relative offset, not a hardcoded absolute date, since the
  // actual seed run date is unknown ahead of time.
  const FUTURE_APPOINTMENT_DAYS = 2;
  const WORK_SCHEDULE_FORWARD_DAYS = 7; // a bit more roster buffer than appointments actually use

  const workSchedules = [];
  const scheduleMap = new Map(); // `${userId}|${dateKey}|${shift}` -> scheduleId
  const rosterStaff = [
    ...doctors.map((d) => ({ id: d.id, roomId: d.roomId })),
    ...labTechs.map((t) => ({ id: t.id, roomId: t.roomId })),
  ];
  for (let offset = -PAST_DAYS_BACK; offset <= WORK_SCHEDULE_FORWARD_DAYS; offset += 1) {
    const date = addDays(todayDateOnly, offset);
    if (date.getUTCDay() === 0) continue; // skip Sunday
    const dateKey = ymdKey(date);
    for (const staff of rosterStaff) {
      for (const shift of ['MORNING', 'AFTERNOON']) {
        const id = uuid();
        workSchedules.push({ id, userId: staff.id, roomId: staff.roomId, workDate: date, shift, createdBy: ADMIN_USER_PLACEHOLDER_ID });
        scheduleMap.set(`${staff.id}|${dateKey}|${shift}`, id);
      }
    }
  }
  await insertMany(prisma.workSchedule, workSchedules);
  console.log(`  ${workSchedules.length} work_schedules rows (${rosterStaff.length} staff x weekdays x 2 shifts)`);

  // ── 6. Medicines ─────────────────────────────────────────────────────
  console.log('Seeding medicines...');
  const medicines = MEDICINES.map((m) => ({ id: uuid(), ...m, createdBy: ADMIN_USER_PLACEHOLDER_ID }));
  await insertMany(prisma.medicine, medicines);
  console.log(`  ${medicines.length} medicines`);

  // ── 7. Supply chain ──────────────────────────────────────────────────
  console.log('Seeding supply chain...');
  const supplyCategories = SUPPLY_CATEGORY_DEFS.map((c) => ({ id: uuid(), ...c }));
  const categoryByKey = Object.fromEntries(supplyCategories.map((c) => [c.key, c]));
  await insertMany(prisma.supplyCategory, supplyCategories.map((c) => ({ id: c.id, name: c.name, description: c.description, createdBy: ADMIN_USER_PLACEHOLDER_ID })));

  const suppliers = SUPPLIER_DEFS.map((s) => ({ id: uuid(), ...s }));
  await insertMany(prisma.supplier, suppliers.map((s) => ({ id: s.id, name: s.name, phone: s.phone, email: s.email, address: s.address, createdBy: ADMIN_USER_PLACEHOLDER_ID })));

  const supplies = SUPPLY_DEFS.map((s) => ({
    id: uuid(), name: s.name, categoryId: categoryByKey[s.categoryKey].id, unit: s.unit,
    minStockLevel: s.minStockLevel, currentStock: 0,
  }));
  const supplyByName = Object.fromEntries(supplies.map((s) => [s.name, s]));

  // Two import batches: tieu_hao supplies from supplier 1, thiet_bi+hoa_chat from supplier 2.
  const importBatch1Names = SUPPLY_DEFS.filter((s) => s.categoryKey === 'tieu_hao').map((s) => s.name);
  const importBatch2Names = SUPPLY_DEFS.filter((s) => ['thiet_bi', 'hoa_chat'].includes(s.categoryKey)).map((s) => s.name);
  const supplyImports = [];
  const supplyImportItems = [];
  const supplyTransactions = [];

  function addImportBatch(supplierId, names, qtyRange, priceRange) {
    const importId = uuid();
    const importDate = addDays(todayDateOnly, -randInt(10, 40));
    let totalValue = 0;
    for (const name of names) {
      const supply = supplyByName[name];
      const quantity = randInt(qtyRange[0], qtyRange[1]);
      const unitPrice = randInt(priceRange[0], priceRange[1]);
      totalValue += quantity * unitPrice;
      supplyImportItems.push({
        id: uuid(), importId, supplyId: supply.id, quantity, unitPrice,
        expiryDate: addDays(todayDateOnly, randInt(180, 730)),
      });
      supplyTransactions.push({
        id: uuid(), supplyId: supply.id, transactionType: 'IMPORT', quantity, importId,
        createdBy: ADMIN_USER_PLACEHOLDER_ID, createdAt: importDate,
      });
      supply.currentStock += quantity;
    }
    supplyImports.push({ id: importId, supplierId, importDate, totalValue, createdBy: ADMIN_USER_PLACEHOLDER_ID });
  }
  addImportBatch(suppliers[0].id, importBatch1Names, [200, 500], [2000, 15000]);
  addImportBatch(suppliers[1].id, importBatch2Names, [10, 50], [50000, 3000000]);

  // A handful of DISTRIBUTE transactions to exam/CLS rooms.
  const distributableNames = [...importBatch1Names, ...importBatch2Names];
  for (const name of pickDistinct(distributableNames, 10)) {
    const supply = supplyByName[name];
    const maxQty = Math.min(supply.currentStock, 40);
    if (maxQty <= 0) continue;
    const quantity = randInt(1, maxQty);
    const room = pick(allRooms.filter((r) => r.type !== 'ADMIN'));
    supplyTransactions.push({
      id: uuid(), supplyId: supply.id, transactionType: 'DISTRIBUTE', quantity: -quantity, roomId: room.id,
      note: `Cấp phát cho phòng ${room.roomCode}`, createdBy: ADMIN_USER_PLACEHOLDER_ID,
      createdAt: addDays(todayDateOnly, -randInt(1, 9)),
    });
    supply.currentStock -= quantity;
  }

  await insertMany(prisma.supply, supplies.map((s) => ({
    id: s.id, categoryId: s.categoryId, name: s.name, unit: s.unit,
    currentStock: s.currentStock, minStockLevel: s.minStockLevel, createdBy: ADMIN_USER_PLACEHOLDER_ID,
  })));
  await insertMany(prisma.supplyImport, supplyImports);
  await insertMany(prisma.supplyImportItem, supplyImportItems);
  await insertMany(prisma.supplyTransaction, supplyTransactions);
  console.log(`  ${supplyCategories.length} categories, ${suppliers.length} suppliers, ${supplies.length} supplies, ${supplyImports.length} imports, ${supplyTransactions.length} transactions`);

  // ── 8. Patients ───────────────────────────────────────────────────────
  console.log('Seeding patients...');
  const PATIENT_COUNT = 70;
  const patients = [];
  const patientUsers = [];
  const patientAllergies = [];
  const medicalRecords = [];

  const linkedUserIndexes = new Set(pickDistinct(Array.from({ length: PATIENT_COUNT }, (_, i) => i), 15));
  const allergyIndexes = new Set(pickDistinct(Array.from({ length: PATIENT_COUNT }, (_, i) => i), 7));
  const medicalRecordIndexes = new Set(pickDistinct(Array.from({ length: PATIENT_COUNT }, (_, i) => i), 15));

  for (let i = 0; i < PATIENT_COUNT; i += 1) {
    const gender = randomGender();
    const genderForName = gender === 'FEMALE' ? 'FEMALE' : 'MALE';
    const fullName = randomVietnameseName(genderForName);
    // Age spread: ~15% children, ~65% adults, ~20% elderly.
    const ageBucket = pickWeighted([['child', 15], ['adult', 65], ['elderly', 20]]);
    let age;
    if (ageBucket === 'child') age = randInt(2, 15);
    else if (ageBucket === 'elderly') age = randInt(66, 90);
    else age = randInt(18, 65);
    const dob = clinicDate(today.getUTCFullYear() - age, randInt(1, 12), randInt(1, 28));
    const phone = nextPhone();
    const hasIdCard = Math.random() < 0.5;
    const registeredAt = addDays(todayDateOnly, -randInt(0, 60));

    const patient = {
      id: uuid(),
      patientCode: nextPatientCode(registeredAt),
      fullName,
      dateOfBirth: dob,
      gender,
      phone,
      idCard: hasIdCard ? nextIdCard() : null,
      address: pick(ADDRESS_POOL),
      notificationConsent: Math.random() < 0.7,
      userId: null,
      createdBy: pick(receptionists).id,
    };

    if (linkedUserIndexes.has(i)) {
      const userId = uuid();
      patientUsers.push({
        id: userId, fullName, email: nextEmail(fullName), phone, passwordHash: patientPasswordHash,
        role: 'PATIENT', mustChangePassword: true, createdBy: null,
      });
      patient.userId = userId;
    }

    patients.push(patient);

    if (allergyIndexes.has(i)) {
      patientAllergies.push({
        id: uuid(), patientId: patient.id, allergen: pick(ALLERGEN_POOL),
        severity: pick(['MILD', 'MODERATE', 'SEVERE']),
        description: 'Ghi nhận qua khai thác tiền sử dị ứng khi khám bệnh.',
        createdBy: pick(doctors).id,
      });
    }
    if (medicalRecordIndexes.has(i)) {
      const specialtyKey = pick(SPECIALTY_DEFS.map((s) => s.key));
      medicalRecords.push({
        id: uuid(), patientId: patient.id,
        medicalHistory: 'Không ghi nhận bệnh mạn tính đặc biệt, tiền sử khám sức khỏe định kỳ ổn định.',
        clinicalNote: 'Bệnh nhân tỉnh, tiếp xúc tốt, sinh hiệu trong giới hạn bình thường ở lần khám gần nhất.',
        diagnosisSummary: pick(DIAGNOSES[specialtyKey]) ?? 'Theo dõi sức khỏe định kỳ.',
        treatmentSummary: 'Điều trị nội khoa theo phác đồ, tái khám theo lịch hẹn của bác sĩ.',
        followUpNote: 'Tái khám nếu triệu chứng không cải thiện hoặc xuất hiện dấu hiệu bất thường.',
        createdBy: pick(doctors).id,
        updatedBy: null,
      });
    }
  }

  await insertMany(prisma.user, patientUsers.map((u) => ({
    id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, passwordHash: u.passwordHash,
    role: u.role, mustChangePassword: u.mustChangePassword, createdBy: u.createdBy,
  })));
  await insertMany(prisma.patient, patients.map((p) => ({
    id: p.id, patientCode: p.patientCode, fullName: p.fullName, dateOfBirth: p.dateOfBirth, gender: p.gender,
    phone: p.phone, idCard: p.idCard, address: p.address, notificationConsent: p.notificationConsent,
    userId: p.userId, createdBy: p.createdBy,
  })));
  await insertMany(prisma.patientAllergy, patientAllergies);
  await insertMany(prisma.medicalRecord, medicalRecords);
  console.log(`  ${patients.length} patients (${patientUsers.length} with linked accounts, ${patientAllergies.length} allergies, ${medicalRecords.length} medical records)`);

  // ── 9. Appointments + full visit chain ─────────────────────────────────
  console.log('Seeding appointments + visits + clinical/billing chain...');
  const appointments = [];
  const visits = [];
  const vitalSignsRows = [];
  const examinationResults = [];
  const clsOrders = [];
  const clsResults = [];
  const prescriptions = [];
  const prescriptionItems = [];
  const invoices = [];
  const invoiceItems = [];
  const invoicePayments = [];
  const invoicePaymentItems = [];

  const queueSeqByRoomDay = new Map(); // `${roomId}|${dateKey}` -> next seq
  function nextQueueNumber(room, dateKey) {
    const key = `${room.id}|${dateKey}`;
    const seq = (queueSeqByRoomDay.get(key) ?? 0) + 1;
    queueSeqByRoomDay.set(key, seq);
    return `${room.roomCode}-${String(seq).padStart(3, '0')}`;
  }

  for (let offset = -PAST_DAYS_BACK; offset <= FUTURE_APPOINTMENT_DAYS; offset += 1) {
    const date = addDays(todayDateOnly, offset);
    if (date.getUTCDay() === 0) continue; // clinic closed Sundays
    const dateKey = ymdKey(date);
    const { y, m, d } = ymdParts(date);
    const isFuture = offset > 0;
    const apptCount = isFuture ? randInt(2, 4) : randInt(4, 7);

    for (let i = 0; i < apptCount; i += 1) {
      const doctor = pick(doctors);
      const service = pick(examServicesBySpecialtyKey[doctor.specialtyKey]);
      const room = examRoomBySpecialtyKey[doctor.specialtyKey];
      const shift = pick(['MORNING', 'AFTERNOON']);
      const { hour, minute } = randomTimeInShift(shift);
      const appointmentTime = clinicDate(y, m, d, hour, minute);
      const patient = pick(patients);
      const scheduleId = scheduleMap.get(`${doctor.id}|${dateKey}|${shift}`) ?? null;
      const bookedBy = patient.userId && Math.random() < 0.3 ? patient.userId : pick(receptionists).id;
      const apptId = uuid();

      if (isFuture) {
        const status = pickWeighted([['CONFIRMED', 70], ['PENDING', 30]]);
        appointments.push({
          id: apptId, patientId: patient.id, doctorId: doctor.id, serviceId: service.id, roomId: room.id,
          scheduleId, appointmentTime, status, note: pick(APPT_NOTE_POOL), bookedBy,
          createdAt: addDays(appointmentTime, -randInt(1, 5)),
        });
        continue;
      }

      const roll = Math.random();
      if (roll < 0.68) {
        // ── COMPLETED path ──
        const checkedInAt = addMinutes(appointmentTime, randInt(-10, 5));
        const calledAt = addMinutes(checkedInAt, randInt(5, 20));
        const startedAt = addMinutes(calledAt, randInt(1, 10));
        const completedAt = addMinutes(startedAt, randInt(10, 30));

        appointments.push({
          id: apptId, patientId: patient.id, doctorId: doctor.id, serviceId: service.id, roomId: room.id,
          scheduleId, appointmentTime, status: 'COMPLETED', note: pick(APPT_NOTE_POOL),
          checkedInAt, bookedBy, createdAt: addDays(appointmentTime, -randInt(1, 5)), updatedAt: completedAt,
        });

        const visitId = uuid();
        const priority = computePriority(patient, todayDateOnly);
        visits.push({
          id: visitId, appointmentId: apptId, patientId: patient.id, doctorId: doctor.id, roomId: room.id,
          queueNumber: nextQueueNumber(room, dateKey), priority, status: 'COMPLETED',
          calledAt, calledCount: 1, startedAt, completedAt, createdAt: checkedInAt,
        });

        const age = getAge(patient.dateOfBirth, date);
        const vitals = buildVitalSigns(age);
        vitalSignsRows.push({
          id: uuid(), visitId, ...vitals, recordedBy: doctor.id, recordedAt: startedAt,
        });

        const diagnosis = pick(DIAGNOSES[doctor.specialtyKey]);
        const hasFollowUp = Math.random() < 0.4;
        examinationResults.push({
          id: uuid(), visitId, diagnosis,
          clinicalNote: `Bệnh nhân tỉnh, tiếp xúc tốt. Mạch ${vitals.heartRate} lần/phút, huyết áp ${vitals.systolicBp}/${vitals.diastolicBp} mmHg, nhiệt độ ${vitals.temperature}°C.`,
          treatmentResult: 'Điều trị nội khoa theo phác đồ, hướng dẫn tái khám nếu triệu chứng không cải thiện.',
          followUpDate: hasFollowUp ? addDays(todayDateOnly, randInt(7, 30)) : null,
          accessCode: generateAccessCode(),
          accessCodeExpiresAt: addDays(completedAt, 30),
          createdBy: doctor.id, createdAt: completedAt, updatedAt: completedAt,
        });

        // Invoice: exam fee line always present (billed at check-in in production).
        const invoiceId = uuid();
        const invoiceCreatedAt = checkedInAt;
        const items = [];
        items.push({
          id: uuid(), invoiceId, itemType: 'SERVICE', serviceRefId: service.id, name: service.name,
          unitPrice: service.price, quantity: 1, amount: service.price,
        });

        // Meaningful subset gets a CLS order.
        if (Math.random() < 0.5) {
          const clsCount = randInt(1, 2);
          const categories = pickDistinct(Object.keys(CLS_SERVICES_PLAN), clsCount);
          for (const category of categories) {
            const clsService = pick(clsServicesByCategory[category]);
            const clsRoom = clsRoomByCategory[category];
            const labTech = labTechs.find((t) => t.category === category) ?? pick(labTechs);
            const clsOrderId = uuid();
            const clsCalledAt = addMinutes(startedAt, randInt(1, 5));
            clsOrders.push({
              id: clsOrderId, visitId, clsRoomId: clsRoom.id, serviceId: clsService.id,
              note: 'Chỉ định cận lâm sàng theo yêu cầu của bác sĩ khám.', status: 'COMPLETED',
              calledAt: clsCalledAt, createdBy: doctor.id, createdAt: clsCalledAt,
            });
            const resultInfo = buildClsResultData(category);
            clsResults.push({
              id: uuid(), clsOrderId, resultData: resultInfo.data, summary: resultInfo.summary,
              createdBy: labTech.id, createdAt: addMinutes(clsCalledAt, randInt(10, 30)),
              updatedAt: addMinutes(clsCalledAt, randInt(10, 30)),
            });
            items.push({
              id: uuid(), invoiceId, itemType: 'CLS', clsRefId: clsOrderId, name: clsService.name,
              unitPrice: clsService.price, quantity: 1, amount: clsService.price,
            });
          }
        }

        // Meaningful subset gets a prescription.
        if (Math.random() < 0.5) {
          const prescriptionId = uuid();
          prescriptions.push({
            id: prescriptionId, visitId, note: 'Uống thuốc đúng giờ theo hướng dẫn, tái khám nếu không thuyên giảm.',
            createdBy: doctor.id, createdAt: completedAt,
          });
          const chosenMedicines = pickDistinct(medicines, randInt(1, 4));
          chosenMedicines.forEach((med, idx) => {
            const durationDays = pick([3, 5, 7, 10, 14]);
            const prescriptionItemId = uuid();
            prescriptionItems.push({
              id: prescriptionItemId, prescriptionId, medicineId: med.id, dosage: pick(DOSAGES),
              frequency: pick(FREQUENCIES), durationDays, instruction: pick(INSTRUCTIONS),
              allergyWarning: Math.random() < 0.05, sortOrder: idx + 1,
            });
            const quantity = durationDays * randInt(1, 3);
            const unitPrice = med.price ?? 5000;
            items.push({
              id: uuid(), invoiceId, itemType: 'MEDICINE', medicineRefId: prescriptionItemId, name: med.name,
              unitPrice, quantity, amount: unitPrice * quantity,
            });
          });
        }

        const subtotal = items.reduce((sum, it) => sum + it.amount, 0);
        const paymentPaidAt = addMinutes(completedAt, randInt(5, 15));
        const method = pickWeighted([['CASH', 60], ['TRANSFER', 30], ['CARD', 10]]);
        items.forEach((it) => { it.paidAt = paymentPaidAt; });

        invoices.push({
          id: invoiceId, appointmentId: apptId, patientId: patient.id, invoiceCode: nextInvoiceCode(invoiceCreatedAt),
          subtotal, discount: 0, total: subtotal, amountDue: 0, paymentStatus: 'PAID', paymentMethod: method,
          paidAt: paymentPaidAt, createdBy: pick(receptionists).id, createdAt: invoiceCreatedAt, updatedAt: paymentPaidAt,
        });
        invoiceItems.push(...items);

        const paymentId = uuid();
        invoicePayments.push({
          id: paymentId, invoiceId, amount: subtotal, method, paidAt: paymentPaidAt,
          createdBy: pick(receptionists).id, note: null,
        });
        for (const it of items) {
          invoicePaymentItems.push({ invoicePaymentId: paymentId, invoiceItemId: it.id });
        }
      } else if (roll < 0.9) {
        // ── CANCELLED path ──
        appointments.push({
          id: apptId, patientId: patient.id, doctorId: doctor.id, serviceId: service.id, roomId: room.id,
          scheduleId, appointmentTime, status: 'CANCELLED', note: pick(APPT_NOTE_POOL),
          cancelReason: pick(CANCEL_REASONS), cancelledBy: pick(receptionists).id,
          cancelledAt: addMinutes(appointmentTime, -randInt(60, 600)), bookedBy,
          createdAt: addDays(appointmentTime, -randInt(1, 5)),
        });
      } else {
        // ── NO_SHOW path (checked in, invoice billed, never called into the room) ──
        const checkedInAt = addMinutes(appointmentTime, randInt(-10, 5));
        const calledAt = addMinutes(checkedInAt, randInt(15, 40));

        appointments.push({
          id: apptId, patientId: patient.id, doctorId: doctor.id, serviceId: service.id, roomId: room.id,
          scheduleId, appointmentTime, status: 'CHECKED_IN', note: pick(APPT_NOTE_POOL),
          checkedInAt, bookedBy, createdAt: addDays(appointmentTime, -randInt(1, 5)),
        });

        const visitId = uuid();
        const priority = computePriority(patient, todayDateOnly);
        visits.push({
          id: visitId, appointmentId: apptId, patientId: patient.id, doctorId: doctor.id, roomId: room.id,
          queueNumber: nextQueueNumber(room, dateKey), priority, status: 'NO_SHOW',
          calledAt, calledCount: 3, createdAt: checkedInAt,
        });

        // Exam fee invoice created at check-in, never collected (unpaid).
        const invoiceId = uuid();
        invoices.push({
          id: invoiceId, appointmentId: apptId, patientId: patient.id, invoiceCode: nextInvoiceCode(checkedInAt),
          subtotal: service.price, discount: 0, total: service.price, amountDue: service.price,
          paymentStatus: 'UNPAID', paymentMethod: null, paidAt: null,
          createdBy: pick(receptionists).id, createdAt: checkedInAt, updatedAt: checkedInAt,
        });
        invoiceItems.push({
          id: uuid(), invoiceId, itemType: 'SERVICE', serviceRefId: service.id, name: service.name,
          unitPrice: service.price, quantity: 1, amount: service.price, paidAt: null,
        });
      }
    }
  }

  await insertMany(prisma.appointment, appointments);
  await insertMany(prisma.visit, visits);
  await insertMany(prisma.vitalSigns, vitalSignsRows);
  await insertMany(prisma.examinationResult, examinationResults);
  await insertMany(prisma.clsOrder, clsOrders);
  await insertMany(prisma.clsResult, clsResults);
  await insertMany(prisma.prescription, prescriptions);
  await insertMany(prisma.prescriptionItem, prescriptionItems);
  await insertMany(prisma.invoice, invoices);
  await insertMany(prisma.invoiceItem, invoiceItems);
  await insertMany(prisma.invoicePayment, invoicePayments);
  await insertMany(prisma.invoicePaymentItem, invoicePaymentItems);

  console.log(`  ${appointments.length} appointments`);
  console.log(`  ${visits.length} visits (${examinationResults.length} completed with exam results)`);
  console.log(`  ${clsOrders.length} CLS orders / ${clsResults.length} CLS results`);
  console.log(`  ${prescriptions.length} prescriptions / ${prescriptionItems.length} prescription items`);
  console.log(`  ${invoices.length} invoices / ${invoiceItems.length} invoice items / ${invoicePayments.length} payments`);

  // ── 10. Light sample logs ───────────────────────────────────────────────
  console.log('Seeding notification/system/AI chat log samples...');
  const allStaffIds = users.map((u) => u.id);
  const allPatientUserIds = patientUsers.map((u) => u.id);

  const notificationLogs = [];
  const NOTIF_TYPES = ['APPOINTMENT_CONFIRMED', 'TEMP_PASSWORD', 'OTP_FORGOT_PASSWORD', 'INVOICE_CREATED', 'CLS_RESULT_READY'];
  for (let i = 0; i < 25; i += 1) {
    const channel = pick(['EMAIL', 'PUSH']);
    const userId = Math.random() < 0.5 ? pick(allStaffIds) : pick(allPatientUserIds.length ? allPatientUserIds : allStaffIds);
    notificationLogs.push({
      id: uuid(), userId, recipient: channel === 'EMAIL' ? `${slugify('nguoi nhan')}${i}@clinic.vn` : `push-token-${i}`,
      channel, type: pick(NOTIF_TYPES), subject: channel === 'EMAIL' ? 'Thông báo từ hệ thống Clinic' : null,
      body: 'Đây là thông báo mẫu phục vụ dữ liệu demo.', status: pickWeighted([['SENT', 85], ['PENDING', 10], ['FAILED', 5]]),
      sentAt: addDays(todayDateOnly, -randInt(0, 30)), createdAt: addDays(todayDateOnly, -randInt(0, 30)),
    });
  }
  await insertMany(prisma.notificationLog, notificationLogs);

  const systemLogs = [];
  const LOG_ACTIONS = [
    ['LOGIN', 'USER'], ['LOGIN_FAILED', 'USER'], ['LOGIN_LOCKED', 'USER'], ['CREATE', 'PATIENT'],
    ['APPOINTMENT_CHECKED_IN', 'APPOINTMENT'], ['INVOICE_PAID', 'INVOICE'], ['MARK_NO_SHOW', 'VISIT'],
    ['CREATE_EXAMINATION_RESULT', 'VISIT'], ['UPDATE', 'APPOINTMENT'],
  ];
  for (let i = 0; i < 25; i += 1) {
    const [action, module] = pick(LOG_ACTIONS);
    systemLogs.push({
      id: uuid(), userId: pick(allStaffIds), action, module, detail: { seed: true, index: i },
      ipAddress: `192.168.1.${randInt(2, 250)}`, createdAt: addDays(todayDateOnly, -randInt(0, 30)),
    });
  }
  await insertMany(prisma.systemLog, systemLogs);

  const aiChatLogs = [];
  const CHAT_TURNS = [
    ['user', 'Tôi bị đau bụng và buồn nôn 2 ngày nay, nên khám chuyên khoa nào?'],
    ['assistant', 'Bạn nên đặt lịch khám Chuyên khoa Nội để được bác sĩ thăm khám và chẩn đoán chính xác.'],
    ['user', 'Tôi bị nghẹt mũi, đau họng kéo dài, nên đi khám ở đâu?'],
    ['assistant', 'Với triệu chứng này bạn nên đặt lịch khám Tai Mũi Họng.'],
    ['user', 'Tôi cần siêu âm ổ bụng thì đặt lịch như thế nào?'],
    ['assistant', 'Bạn có thể đặt lịch khám tư vấn Chẩn đoán hình ảnh, bác sĩ sẽ chỉ định siêu âm phù hợp.'],
  ];
  for (let i = 0; i < 25; i += 1) {
    const sessionId = uuid();
    const [role, message] = pick(CHAT_TURNS);
    aiChatLogs.push({
      id: uuid(), userId: Math.random() < 0.6 ? pick(allPatientUserIds.length ? allPatientUserIds : allStaffIds) : null,
      sessionId, role, message,
      suggestedSpecialtyId: role === 'assistant' ? pick(specialties).id : null,
      createdAt: addDays(todayDateOnly, -randInt(0, 30)),
    });
  }
  await insertMany(prisma.aiChatLog, aiChatLogs);
  console.log(`  ${notificationLogs.length} notification_logs, ${systemLogs.length} system_logs, ${aiChatLogs.length} ai_chat_logs`);

  console.log('\n' + '='.repeat(78));
  console.log('  DONE');
  console.log('='.repeat(78));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
