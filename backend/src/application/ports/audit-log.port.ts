export const AUDIT_LOG_PORT = Symbol('AUDIT_LOG_PORT');

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  module: string;
  targetId?: string | null;
  detail?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogPort {
  write(input: AuditLogInput): Promise<void>;
}
