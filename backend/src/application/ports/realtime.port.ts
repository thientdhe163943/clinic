export const REALTIME_PORT = Symbol('REALTIME_PORT');

/**
 * Fire-and-forget realtime push to connected clients. Implementations must
 * never throw back to the caller — an emit failure should never block or
 * fail the use case that triggered it (mirrors the "never blocks the actor"
 * convention used by NotificationPort).
 */
export interface RealtimePort {
  /**
   * `target` is either one or more role names (every connected socket for
   * that role, e.g. every RECEPTIONIST) or a specific userId (that one
   * person's session(s) only, across any role) — the gateway joins each
   * connected socket to both its role room and its own userId room on
   * connect, so either kind of string works as a room name here without the
   * caller needing to know which one it's addressing.
   */
  emit(target: string | string[], event: string, payload: unknown): void;
}
