import type { VisitStatus } from '@/types/visits';

export type BadgeVariant = 'success' | 'warning' | 'default' | 'muted' | 'danger';

const STATUS_LABEL: Record<VisitStatus, string> = {
  WAITING: 'Đang chờ',
  CALLED: 'Đã gọi',
  IN_PROGRESS: 'Đang khám',
  AWAITING_RESULTS: 'Chờ kết quả CLS',
  COMPLETED: 'Hoàn tất',
  NO_SHOW: 'Vắng mặt',
  CANCELLED: 'Đã hủy',
};

const STATUS_VARIANT: Record<VisitStatus, BadgeVariant> = {
  WAITING: 'warning',
  CALLED: 'default',
  IN_PROGRESS: 'default',
  AWAITING_RESULTS: 'muted',
  COMPLETED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'danger',
};

const NON_TERMINAL_STATUSES: VisitStatus[] = ['WAITING', 'CALLED', 'IN_PROGRESS', 'AWAITING_RESULTS'];

function isPastDay(value: string) {
  const created = new Date(value);
  if (isNaN(created.getTime())) return false;
  return created.toDateString() !== new Date().toDateString() && created.getTime() < Date.now();
}

// Bệnh án screens (patient's own "Lịch sử khám bệnh" + doctor/receptionist
// "Bệnh án" lookup) never show raw enum text — a visit left in a
// non-terminal status (WAITING/CALLED/IN_PROGRESS/AWAITING_RESULTS) from a
// previous day never actually concluded (patient never showed / clinic day
// ended); the backend has no automatic transition to NO_SHOW for that case
// (only a manual action from CALLED), so relabel it here rather than
// leaving a stale "Đang chờ" on screen indefinitely.
export function resolveVisitDisplayStatus(visit: { status: VisitStatus; createdAt: string }): {
  label: string;
  variant: BadgeVariant;
} {
  if (NON_TERMINAL_STATUSES.includes(visit.status) && isPastDay(visit.createdAt)) {
    return { label: 'Vắng', variant: 'danger' };
  }
  return { label: STATUS_LABEL[visit.status], variant: STATUS_VARIANT[visit.status] };
}
