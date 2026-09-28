import { MSG, MessageCode } from '../../domain/value-objects/message-code.vo';

// ApplicationError là "lớp cha" chung cho MỌI loại lỗi nghiệp vụ trong hệ
// thống (ví dụ: không tìm thấy dữ liệu, sai mật khẩu, trùng thông tin...).
// Khi 1 use case (ví dụ GetMyProfileUseCase) "throw" (ném) một lỗi thuộc họ
// này, có 1 bộ phận trung tâm (global-exception.filter.ts) tự động bắt lấy
// và chuyển thành phản hồi lỗi chuẩn gửi về cho Frontend, gồm:
//   - statusCode: mã trạng thái HTTP (404 = không tìm thấy, 400 = dữ liệu
//     không hợp lệ, 401 = chưa đăng nhập/sai mật khẩu...).
//   - code: mã lỗi nội bộ, dùng để tra ra câu thông báo tiếng Việt hiển thị
//     cho người dùng (ví dụ "Không tìm thấy Người dùng.").
export class ApplicationError extends Error {
  constructor(
    public readonly code: MessageCode,
    public readonly statusCode = 400,
    public readonly params?: Record<string, string | number>,
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// MSG_ERR_0009's template is "Không tìm thấy {resource}." (Vietnamese) —
// every call site across the codebase historically passed the raw English
// entity/class name (e.g. `new ResourceNotFoundError('Doctor')`), which
// leaked untranslated words straight into a user-facing message ("Không
// tìm thấy Doctor."). Translating centrally here fixes every existing call
// site at once, and a call site with a name not yet in this map falls back
// to the raw string rather than throwing, so a future omission degrades
// gracefully instead of crashing — but should still be added below.
const RESOURCE_LABEL_VI: Record<string, string> = {
  Appointment: 'Lịch hẹn',
  ClsOrder: 'Phiếu chỉ định CLS',
  'CLS room': 'Phòng CLS',
  Doctor: 'Bác sĩ',
  'Doctor profile': 'Hồ sơ bác sĩ',
  ExaminationResult: 'Kết quả khám',
  Invoice: 'Hóa đơn',
  Medicine: 'Thuốc',
  Message: 'Thông báo',
  Patient: 'Bệnh nhân',
  'Pending doctor specialty update': 'Yêu cầu cập nhật chuyên khoa đang chờ duyệt',
  Prescription: 'Đơn thuốc',
  Resource: 'Dữ liệu',
  Room: 'Phòng',
  Schedule: 'Lịch làm việc',
  Service: 'Dịch vụ',
  Supplier: 'Nhà cung cấp',
  Supply: 'Vật tư',
  SupplyCategory: 'Danh mục vật tư',
  User: 'Người dùng',
  Visit: 'Lượt khám',
};

// Vietnamese labels for ShiftType, used by ScheduleConflictError /
// ScheduleRoomConflictError so a raw Prisma enum value ("MORNING") never
// leaks into a user-facing message.
const SHIFT_LABEL_VI: Record<string, string> = {
  MORNING: 'Sáng',
  AFTERNOON: 'Chiều',
  FULL_DAY: 'Cả ngày',
};

// Vietnamese labels for MeasurementUnit, used by InsufficientStockError (and
// exported for supplies.controller.ts's INFO_0071/INFO_0072 success
// messages, which have the same {unit} placeholder) so a raw Prisma enum
// value ("HOP") never leaks into a user-facing message — same pattern as
// RESOURCE_LABEL_VI/SHIFT_LABEL_VI above (2026-08-07 message-content audit,
// Phase 2.2 of the message-system plan).
export const UNIT_LABEL_VI: Record<string, string> = {
  VIEN: 'viên',
  VI: 'vỉ',
  HOP: 'hộp',
  CHAI: 'chai',
  ONG: 'ống',
  GOI: 'gói',
  TUYP: 'tuýp',
  LO: 'lọ',
  CAI: 'cái',
  BO: 'bộ',
  KHAC: 'khác',
};

// `date` arrives as an ISO yyyy-mm-dd string (see create-schedule.use-case.ts
// / update-schedule.use-case.ts) — reformat to the dd/MM/yyyy convention
// used everywhere else in this app's user-facing text.
function formatDateVi(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return y && m && d ? `${d}/${m}/${y}` : isoDate;
}

// Lỗi "Không tìm thấy dữ liệu" (HTTP 404) — dùng khi tra database mà không
// thấy bản ghi cần tìm. Ví dụ trong luồng "Xem hồ sơ cá nhân": nếu userId
// không khớp tài khoản nào trong bảng "users", GetMyProfileUseCase sẽ ném
// `new ResourceNotFoundError('User')`, và người dùng cuối sẽ thấy thông báo
// "Không tìm thấy Người dùng." (chữ "User" được tự động dịch sang tiếng Việt
// nhờ bảng RESOURCE_LABEL_VI ở trên).
export class ResourceNotFoundError extends ApplicationError {
  constructor(resource: string, details?: unknown) {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI[resource] ?? resource }, details);
  }
}

export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0012, 401);
  }
}

export class IncorrectCurrentPasswordError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0137, 401);
  }
}

export class AccountLockedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0002, 403);
  }
}

export class AccountInactiveError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0014, 403);
  }
}

export class InvalidOtpError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0005, 400);
  }
}

export class WeakPasswordError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0013, 400);
  }
}

export class SamePasswordError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0015, 400);
  }
}

export class PasswordMismatchError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0066, 400);
  }
}

export class InvalidSessionError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0007, 401);
  }
}

export class ConflictError extends ApplicationError {
  // `resource` must be a human-readable Vietnamese label (e.g. 'Email', 'Số
  // điện thoại', 'CCCD/CMND') — it's interpolated directly into
  // MSG_ERR_0010's "{resource} đã tồn tại hoặc bị xung đột." template, so a
  // raw field name here (e.g. 'idCard', 'appointmentTime') would leak an
  // internal identifier into a user-facing message instead of telling them
  // what's actually wrong.
  constructor(resource: string, details?: unknown) {
    super(MSG.ERR_0010, 409, { resource }, details);
  }
}

export class ServiceInUseError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0028, 409);
  }
}

export class ForbiddenActionError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0008, 403);
  }
}

export class DoctorNotScheduledError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0033, 400);
  }
}

// The doctor-less ("Đặt lịch nhanh") booking path has no doctor/shift to
// validate against via DoctorNotScheduledError above, so the clinic's lunch
// break (between the MORNING and AFTERNOON shift windows) must be checked
// explicitly here instead.
export class LunchBreakBookingError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0070, 400);
  }
}

export class CancelReasonRequiredError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0034, 400);
  }
}

export class AppointmentCancelNotAllowedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0035, 409);
  }
}

export class AppointmentUpdateNotAllowedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0036, 409);
  }
}

export class AppointmentSlotConflictError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0037, 409);
  }
}

export class RejectReasonRequiredError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0038, 400);
  }
}

export class AppointmentTimeInPastError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0062, 400);
  }
}

export class CheckInDateMismatchError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0063, 409);
  }
}

export class AppointmentNotConfirmedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0075, 409);
  }
}

export class CheckInAlreadyConfirmedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0146, 409);
  }
}

export class AppointmentNotPendingError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0076, 409);
  }
}

export class AppointmentNotCheckedInError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0077, 409);
  }
}

export class ServiceSpecialtyMissingError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0057, 400);
  }
}

export class AppointmentServiceTypeInvalidError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0074, 400);
  }
}

export class ScheduleConflictError extends ApplicationError {
  constructor(shift: string, date: string) {
    super(MSG.ERR_0031, 409, { shift: SHIFT_LABEL_VI[shift] ?? shift, date: formatDateVi(date) });
  }
}

export class ScheduleRoomConflictError extends ApplicationError {
  constructor(shift: string, date: string) {
    super(MSG.ERR_0058, 409, { shift: SHIFT_LABEL_VI[shift] ?? shift, date: formatDateVi(date) });
  }
}

export class LeaveDateRangeInvalidError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0061, 400);
  }
}

export class ScheduleHasAppointmentsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0032, 409);
  }
}

export class ScheduleRoomInactiveError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0006, 400);
  }
}

export class SchedulePastDateError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0006, 400);
  }
}

export class ScheduleRoomMissingError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0006, 400);
  }
}

// Version-up 0.2 plan item #9 tình huống B (added 2026-08-19): ADMIN reassigns
// a substitute doctor onto an absent doctor's shift (ReassignScheduleDoctorUseCase).
export class ScheduleSubstituteNotDoctorError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0140, 400);
  }
}

export class ScheduleSubstituteSameDoctorError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0141, 400);
  }
}

export class VisitNotFoundError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI.Visit });
  }
}

export class VisitNotWaitingError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0078, 409);
  }
}

export class VisitNotInProgressError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0079, 409);
  }
}

export class VisitNotCallableError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0080, 409);
  }
}

export class VisitNotStartableError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0081, 409);
  }
}

export class VisitNotHoldableError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0082, 409);
  }
}

export class VisitNoClsOrderForHoldError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0059, 409);
  }
}

export class VisitNotCalledError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0083, 409);
  }
}

export class VisitTicketNotPrintableError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0084, 409);
  }
}

export class RoomBusyError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0064, 409);
  }
}

export class ClsOrderNotFoundError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI.ClsOrder });
  }
}

export class ClsOrderDuplicateServiceError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0010, 409, { resource: RESOURCE_LABEL_VI.ClsOrder });
  }
}

export class ClsOrderNotPendingError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0085, 409);
  }
}

export class ClsOrderNotInProgressError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0086, 409);
  }
}

export class ClsResultAlreadyConfirmedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0147, 409);
  }
}

export class ClsResultNotEnteredError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0148, 400);
  }
}

export class ClsRoomBusyError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0087, 409);
  }
}

export class ClsRoomNotActiveError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0006, 400);
  }
}

// Phase 4 of the 2026-08-07 message-system plan — replaces 4 hardcoded
// NestJS BadRequestException throws in cls-orders.controller.ts /
// uploads.controller.ts (fileFilter callbacks + manual checks) that bypassed
// the message catalog entirely.
export class InvalidAttachmentTypeError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0133, 400);
  }
}

export class NoFileUploadedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0134, 400);
  }
}

// Also covers prisma-cls-order.repository.ts's addAttachment() invariant
// (previously a plain `throw new Error(...)`, same business meaning).
export class AttachmentBeforeResultSavedError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0135, 400);
  }
}

export class InvalidAvatarTypeError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0136, 400);
  }
}

export class ClsRoomTypeError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0006, 400);
  }
}

export class VisitHasIncompleteClsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0088, 409);
  }
}

export class ExaminationResultExistsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0089, 409);
  }
}

export class ExaminationResultNotFoundError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI.ExaminationResult });
  }
}

export class ExaminationResultRequiredError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0065, 409);
  }
}

export class AccessCodeInvalidError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI.ExaminationResult });
  }
}

export class AccessCodeExpiredError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0090, 409);
  }
}

export class PrescriptionExistsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0091, 409);
  }
}

export class PrescriptionNotFoundError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI.Prescription });
  }
}

// `name` is only used for internal `details`/logging — the message itself
// is a fixed Vietnamese label, since call sites sometimes only have a raw
// medicine id (not a name) at the point this is thrown, which used to leak
// straight into the user-facing "Không tìm thấy {resource}." text.
export class MedicineNotFoundError extends ApplicationError {
  constructor(name: string) {
    super(MSG.ERR_0009, 404, { resource: RESOURCE_LABEL_VI.Medicine }, { name });
  }
}

export class InvoiceAlreadyExistsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0044, 409);
  }
}

// Renamed from AppointmentNotCompletedForInvoiceError (version-up 0.2 item
// #10) — POST /invoices is now only a fallback for appointments checked in
// before this feature shipped, so the precondition relaxed from
// "Appointment.COMPLETED" to "Appointment.checkedInAt is set" (see
// CreateInvoiceUseCase / MSG.ERR_0045's updated wording).
export class AppointmentNotCheckedInForInvoiceError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0045, 409);
  }
}

export class InvoiceAlreadyPaidError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0092, 409);
  }
}

export class AiProviderUnavailableError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0093, 503);
  }
}

export class AiRateLimitExceededError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0094, 429);
  }
}

// ─── Appointment booking anti-spam (version-up 0.2, item #7) ──────────────

export class BookingRateLimitExceededError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0138, 429);
  }
}

export class TooManyPendingAppointmentsError extends ApplicationError {
  constructor(count: number, limit: number) {
    super(MSG.ERR_0139, 409, { count, limit });
  }
}

// ─── Medical Supply Management (Features 23-30, 78-81) ────────────────────

export class SupplyCategoryNameExistsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0046, 409);
  }
}

export class SupplyCategoryInUseError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0047, 409);
  }
}

export class InsufficientStockError extends ApplicationError {
  constructor(currentStock: number, unit: string, quantity: number) {
    const unitLabel = UNIT_LABEL_VI[unit] ?? unit;
    super(MSG.ERR_0049, 409, { current_stock: currentStock, unit: unitLabel, quantity });
  }
}

export class InvalidQuantityError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0050, 400);
  }
}

export class SupplyRoomInactiveError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0006, 400);
  }
}

// New codes (2026-07-25) — Feature 26's two delete guards had no reserved
// code among the ones pre-reserved for this module (ERR_0046-ERR_0050).
export class SupplyHasStockError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0067, 409);
  }
}

export class SupplyHasTransactionHistoryError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0068, 409);
  }
}

// ─── Medicine / Supplier Management (Features 70-77) ───────────────────────

export class MedicineNameExistsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0051, 409);
  }
}

export class MedicineInUseError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0052, 409);
  }
}

export class SupplierNameExistsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0048, 409);
  }
}

// Renumbered from ERR_0067 during the develop merge (2026-07-25): that code
// was independently claimed by SupplyHasStockError above (a sibling branch,
// not visible to whoever built this on its own branch) — ERR_0069 is the
// next free code.
export class SupplierInUseError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0069, 409);
  }
}

// ─── Service <-> CLS room category linkage (2026-08-01) ───────────────────

export class ServiceClsCategoryRequiredError extends ApplicationError {
  // "Dịch vụ CLS phải chọn loại phòng thực hiện (clsCategory)"
  constructor() {
    super(MSG.ERR_0071, 400);
  }
}

export class ServiceClsCategoryNotAllowedError extends ApplicationError {
  // "Dịch vụ khám (EXAMINATION) không được gán loại phòng CLS"
  constructor() {
    super(MSG.ERR_0072, 400);
  }
}

export class ClsServiceRoomCategoryMismatchError extends ApplicationError {
  // "Dịch vụ CLS không khớp với loại phòng đã chọn"
  constructor() {
    super(MSG.ERR_0073, 409);
  }
}

// ─── Payment split by stage (version-up 0.2, item #10) ─────────────────────

// Gate #1 — StartVisitUseCase: the appointment's exam-fee InvoiceItem
// (itemType=SERVICE, created at check-in by InvoiceBillingService) must be
// paidAt != null before the doctor may start the visit.
export class ExaminationFeeNotPaidError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0143, 409);
  }
}

// Gate #2 — CallPatientToClsUseCase: the InvoiceItem billed for this
// specific ClsOrder (itemType=CLS, appended when the order was created)
// must be paidAt != null before the CLS room may call the patient in.
export class ClsFeeNotPaidError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0144, 409);
  }
}

// PayInvoiceUseCase: itemIds resolved to nothing payable — either an empty
// invoice, every item already paid, or an id that doesn't belong to this
// invoice at all.
export class InvalidPayInvoiceItemsError extends ApplicationError {
  constructor() {
    super(MSG.ERR_0145, 400);
  }
}
