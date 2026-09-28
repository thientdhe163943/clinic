import { NextRequest, NextResponse } from 'next/server';
import { getRoleHome, isRoleAllowedPath } from '@/lib/auth/routes';
import type { UserRole } from '@/types/auth';

const PUBLIC_PATHS = ['/', '/login', '/register', '/forgot-password', '/guest-booking', '/clinic', '/admin/rooms'];

// The access token is an httpOnly cookie (set by the backend), so it isn't
// readable by page JS — but Next middleware runs on the server and can still
// read it via request.cookies. We only need the `role` claim for route
// guarding here; the backend independently re-verifies the token signature
// and role on every API call, so an unverified decode is fine for this
// UX-level redirect.
function decodeRole(token: string): UserRole | null {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const claims = JSON.parse(json) as { role?: UserRole };
    return claims.role ?? null;
  } catch {
    return null;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

// Access tokens are short-lived (15m) while refresh_token lives 7 days — a
// plain "no valid access_token -> /login" check would force a full re-login
// on every cold navigation (clicking a <Link>, hitting reload) past that
// 15-minute mark, even though the session is still good. This mirrors what
// the axios interceptor does for in-page API calls (src/lib/api/client.ts),
// but has to be redone here because a fresh navigation goes through
// middleware *before* any client JS/axios call happens.
async function tryRefreshCookies(request: NextRequest): Promise<Headers | null> {
  const refreshToken = request.cookies.get('refresh_token')?.value;
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { cookie: `refresh_token=${refreshToken}` },
    });
    if (!res.ok) return null;
    return res.headers;
  } catch {
    return null;
  }
}

function forwardSetCookies(from: Headers, to: NextResponse): void {
  const setCookies = typeof from.getSetCookie === 'function' ? from.getSetCookie() : [from.get('set-cookie') ?? ''];
  for (const cookie of setCookies) {
    if (cookie) to.headers.append('set-cookie', cookie);
  }
}

function accessTokenFromSetCookies(from: Headers): string | null {
  const setCookies = typeof from.getSetCookie === 'function' ? from.getSetCookie() : [from.get('set-cookie') ?? ''];
  for (const cookie of setCookies) {
    const match = /^access_token=([^;]+)/.exec(cookie);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const rootToken = request.cookies.get('access_token')?.value;
    const rootRole = rootToken ? decodeRole(rootToken) : null;

    if (rootToken && rootRole) {
      return NextResponse.redirect(new URL(getRoleHome(rootRole), request.url));
    }

    return NextResponse.redirect(new URL('/clinic', request.url));
  }

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('access_token')?.value;
  let role = token ? decodeRole(token) : null;
  let refreshedHeaders: Headers | null = null;

  if (!token || !role) {
    refreshedHeaders = await tryRefreshCookies(request);
    const refreshedAccessToken = refreshedHeaders ? accessTokenFromSetCookies(refreshedHeaders) : null;
    role = refreshedAccessToken ? decodeRole(refreshedAccessToken) : null;

    if (!role) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  if (!isRoleAllowedPath(role, pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const response = NextResponse.next();
  if (refreshedHeaders) forwardSetCookies(refreshedHeaders, response);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
