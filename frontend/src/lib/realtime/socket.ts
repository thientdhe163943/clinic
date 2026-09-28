import { io, type Socket } from 'socket.io-client';

// The REST API origin is `NEXT_PUBLIC_API_URL` with the `/api/v1` path
// suffix stripped — the Socket.IO server is mounted on the bare API host,
// not under the versioned REST path (see src/lib/api/client.ts).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
export const SOCKET_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

// Single shared Socket.IO connection for the whole tab. Every domain hook
// (useAppointmentEvents, useVisitEvents, useClsOrderEvents, ...) attaches/
// detaches its own event listeners on this one socket instead of opening a
// new connection per hook — otherwise a page that mounts several of these
// hooks at once (e.g. a dashboard header + a page body) would open that many
// redundant websocket connections.
//
// Connect-once-per-tab, never disconnect policy: the server auto-joins each
// socket to its role room + userId room from the httpOnly cookie on connect,
// and reconnection after a network blip re-joins those rooms automatically.
// Reference-counting connect/disconnect would only save one idle websocket
// per tab while any dashboard page is open, at the cost of extra reconnect
// churn (and the auth cookie is still valid the whole session) — not worth
// the complexity here, consistent with how this codebase already keeps
// cross-cutting infra simple. The socket is left connected for the lifetime
// of the tab/page; the browser tears it down on unload/navigAway-from-app.
let socket: Socket | null = null;

export function getRealtimeSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_ORIGIN, { withCredentials: true });
  }
  return socket;
}
