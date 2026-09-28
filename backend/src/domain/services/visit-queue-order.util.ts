import { CHECK_IN_GRACE_PERIOD_MINUTES } from '../constants/visit-queue.constant';
import { VisitPriority } from '../enums/visit-priority.enum';
import { VisitStatus } from '../enums/visit-status.enum';

// Feature 15 business rules (added 2026-07-07/2026-07-14): the queue is
// sorted by priority DESC, then by a within-priority status tier (patients
// coming back from AwaitingResults/Called jump the queue, NoShow sinks to
// the bottom), then by effective_queue_time ASC.

const PRIORITY_RANK: Record<VisitPriority, number> = {
  [VisitPriority.EMERGENCY]: 3,
  [VisitPriority.ELDERLY]: 2,
  [VisitPriority.PREGNANT]: 2,
  [VisitPriority.CHILD]: 2,
  [VisitPriority.NORMAL]: 1,
};

const STATUS_TIER: Partial<Record<VisitStatus, number>> = {
  [VisitStatus.AWAITING_RESULTS]: 0,
  [VisitStatus.CALLED]: 0,
  [VisitStatus.WAITING]: 1,
  [VisitStatus.NO_SHOW]: 2,
};

/**
 * appointment_time if checked in within the grace period (or for walk-ins,
 * where appointment_time already equals checked_in_at); otherwise the
 * actual checked_in_at, so a very late arrival no longer keeps their
 * original place ahead of patients who arrived on time later.
 */
export function effectiveQueueTime(appointmentTime: Date, checkedInAt: Date | null): Date {
  if (!checkedInAt) return appointmentTime;
  const graceMs = CHECK_IN_GRACE_PERIOD_MINUTES * 60 * 1000;
  if (checkedInAt.getTime() <= appointmentTime.getTime() + graceMs) return appointmentTime;
  return checkedInAt;
}

export function compareVisitQueueOrder(
  a: { priority: VisitPriority; status: VisitStatus; effectiveQueueTime: Date },
  b: { priority: VisitPriority; status: VisitStatus; effectiveQueueTime: Date },
): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
  if (priorityDiff !== 0) return priorityDiff;

  const tierDiff = (STATUS_TIER[a.status] ?? 1) - (STATUS_TIER[b.status] ?? 1);
  if (tierDiff !== 0) return tierDiff;

  return a.effectiveQueueTime.getTime() - b.effectiveQueueTime.getTime();
}
