import { SystemLog } from '../entities/system-log.entity';

export const SYSTEM_LOG_REPOSITORY = Symbol('SYSTEM_LOG_REPOSITORY');

// Feature 82 — System Log Management (read-only; logs are append-only and
// written exclusively via AuditLogPort, never through this repository).
export interface SystemLogFilters {
  userId?: string;
  from?: Date;
  to?: Date;
  action?: string;
  module?: string;
}

export interface SystemLogListItem {
  log: SystemLog;
  /** Resolved from users.full_name; null when userId is null (e.g. an unauthenticated failed-login attempt) or the user no longer exists. */
  actorName: string | null;
}

export interface SystemLogRepository {
  findMany(filters: SystemLogFilters, skip: number, take: number): Promise<SystemLogListItem[]>;
  count(filters: SystemLogFilters): Promise<number>;
}
