import { UserRole } from '../enums/user-role.enum';

const DOCTOR_PREFIX = 'BS.';

export class DoctorDisplayName {
  // fullName is stored clean in the DB (see database/seed.sql) — the "BS."
  // prefix is added here at display/response time instead, so it never has
  // to be kept in sync across every doctor row.
  static format(fullName: string): string {
    return fullName.startsWith(DOCTOR_PREFIX) ? fullName : `${DOCTOR_PREFIX} ${fullName}`;
  }

  // Work schedules belong to any staff role, not just doctors — only prefix
  // when the schedule's owning user is actually a DOCTOR.
  static formatForRole(fullName: string, role: UserRole | string): string {
    return role === UserRole.DOCTOR ? this.format(fullName) : fullName;
  }
}
