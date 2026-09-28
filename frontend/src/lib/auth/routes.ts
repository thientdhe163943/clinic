import type { UserRole } from '@/types/auth';

export const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: '/admin',
  RECEPTIONIST: '/receptionist',
  DOCTOR: '/doctor',
  NURSE: '/nurse',
  LAB_TECH: '/lab',
  PATIENT: '/clinic',
};

export const ROLE_PREFIX: Record<UserRole, string> = {
  ADMIN: '/admin',
  RECEPTIONIST: '/receptionist',
  DOCTOR: '/doctor',
  NURSE: '/nurse',
  LAB_TECH: '/lab',
  PATIENT: '/clinic',
};

export function getRoleHome(role?: UserRole | null): string {
  return role ? ROLE_HOME[role] : '/login';
}

const SHARED_AUTHENTICATED_PATHS = ['/profile', '/change-password'];

export function isRoleAllowedPath(role: UserRole, pathname: string): boolean {
  if (SHARED_AUTHENTICATED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }

  if (pathname === '/my-medical-record' || pathname.startsWith('/my-medical-record/')) {
    return role === 'PATIENT';
  }

  if (pathname === '/medical-record' || pathname.startsWith('/medical-record/')) {
    return role === 'ADMIN' || role === 'RECEPTIONIST';
  }

  if (role === 'PATIENT') {
    return (
      pathname.startsWith('/clinic') ||
      pathname.startsWith('/results') ||
      pathname.startsWith('/book-appointment') ||
      pathname.startsWith('/my-appointments')
    );
  }

  return pathname.startsWith(ROLE_PREFIX[role]);
}
