export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');

export type NotifyChannel = 'EMAIL';

export interface NotifyInput {
  userId?: string | null;
  /** Email address. */
  recipient: string;
  channel: NotifyChannel;
  /** notification_logs.type, e.g. APPOINTMENT_CONFIRMED, CLS_ORDER_CREATED, RESULT_READY. */
  type: string;
  subject?: string | null;
  body: string;
  /** ID of the entity this notification is about (appointment, visit, cls order...). */
  refId?: string | null;
}

/**
 * Writes a notification_logs row and dispatches it through EmailPort.
 * A dispatch failure never throws back to the caller — it is recorded as
 * status=FAILED on the log row (see business rules across Feature 59/62/65:
 * "notification failure does not block the actor").
 */
export interface NotificationPort {
  notify(input: NotifyInput): Promise<void>;
}
