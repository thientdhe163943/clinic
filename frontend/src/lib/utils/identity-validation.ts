// Shared field rules for the 4 "identity" fields that recur across every
// patient/account form (đăng ký, đặt lịch nhanh, hồ sơ cá nhân, lễ tân tạo
// bệnh nhân, admin tạo tài khoản nhân viên) — kept in one place so the rule
// itself (10-digit VN phone, 12-digit CCCD, well-formed email, họ tên tối
// đa 100 ký tự — matches the `full_name` VARCHAR(100) column) can't drift
// between forms. Mirrors the equivalent @Matches/@MaxLength rules on the
// backend DTOs (see clinic_system/src/application/dtos/shared/identity-validation.ts).

export const PHONE_REGEX = /^0\d{9}$/;
export const ID_CARD_REGEX = /^\d{12}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const FULL_NAME_MAX_LENGTH = 100;

export function validateFullName(value: string, opts: { required?: boolean } = {}): string | undefined {
  const { required = true } = opts;
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Họ tên không được để trống' : undefined;
  if (trimmed.length > FULL_NAME_MAX_LENGTH) return `Họ tên không được vượt quá ${FULL_NAME_MAX_LENGTH} ký tự`;
  return undefined;
}

export function validatePhone(value: string, opts: { required?: boolean } = {}): string | undefined {
  const { required = true } = opts;
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Số điện thoại không được để trống' : undefined;
  if (!PHONE_REGEX.test(trimmed)) return 'Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0';
  return undefined;
}

export function validateEmail(value: string | undefined | null, opts: { required?: boolean } = {}): string | undefined {
  const { required = false } = opts;
  const trimmed = (value ?? '').trim();
  if (!trimmed) return required ? 'Email không được để trống' : undefined;
  if (!EMAIL_REGEX.test(trimmed)) return 'Email không hợp lệ';
  return undefined;
}

export function validateIdCard(value: string | undefined | null, opts: { required?: boolean } = {}): string | undefined {
  const { required = false } = opts;
  const trimmed = (value ?? '').trim();
  if (!trimmed) return required ? 'CCCD/CMND không được để trống' : undefined;
  if (!ID_CARD_REGEX.test(trimmed)) return 'CCCD/CMND phải gồm đúng 12 chữ số';
  return undefined;
}

// value is a plain YYYY-MM-DD string from <input type="date">.
export function validateDateOfBirth(value: string, opts: { required?: boolean } = {}): string | undefined {
  const { required = true } = opts;
  if (!value) return required ? 'Ngày sinh không được để trống' : undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Ngày sinh không hợp lệ';
  if (date.getTime() > Date.now()) return 'Ngày sinh không được ở tương lai';
  return undefined;
}
