// Shared password strength rule: at least 8 characters, containing at
// least one letter and one digit (see docs/features/sprint2/01_authentication.md).
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

// Every patient account created on their behalf (walk-in via Feature 12/
// CreatePatientUseCase) starts with this same fixed password — the patient
// is always forced to change it (mustChangePassword: true) on first login,
// so the shared-default window is exactly "until they first log in", not a
// standing credential. Satisfies PASSWORD_PATTERN itself.
export const DEFAULT_PATIENT_PASSWORD = 'Patient@123';

// Every staff account an Admin creates (Feature 8, no more admin-typed
// password) or resets (Feature 10-style reset-to-default) starts with this
// same fixed password — mustChangePassword: true always forces the staff
// member to set their own on first login, so the shared-default window is
// exactly "until they first log in". Satisfies PASSWORD_PATTERN itself.
export const DEFAULT_STAFF_PASSWORD = 'Staff@123';

export class PasswordPolicy {
  static isStrong(password: string): boolean {
    return PASSWORD_PATTERN.test(password);
  }
}
