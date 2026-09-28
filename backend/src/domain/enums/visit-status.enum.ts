export enum VisitStatus {
  WAITING = 'WAITING',
  CALLED = 'CALLED',
  IN_PROGRESS = 'IN_PROGRESS',
  AWAITING_RESULTS = 'AWAITING_RESULTS',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  // A past-day visit that never reached COMPLETED, auto-set by the
  // end-of-day cleanup job — distinct from NO_SHOW, which means the patient
  // never arrived at all (see RunEndOfDayCleanupUseCase).
  CANCELLED = 'CANCELLED',
}
