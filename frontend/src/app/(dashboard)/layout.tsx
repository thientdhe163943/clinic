'use client';

import { useEffect } from 'react';
import { DashboardShell } from '@/components/shared/dashboard-shell';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useAuthStore } from '@/stores/auth.store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);

  // Middleware already guarantees a valid session cookie reached this layout
  // (it checks the JWT's role claim before allowing the request through) —
  // but the client-side Zustand store can still be empty here (e.g.
  // localStorage was cleared, or this is a fresh tab that never ran the
  // login mutation). Previously this fell back to `role = user?.role ??
  // 'ADMIN'`, which showed the full admin menu to anyone in that state
  // regardless of their real role. Self-heal instead: re-fetch the real
  // profile and populate the store, never guess a role.
  const { data: profile } = useProfile({ enabled: !user });

  useEffect(() => {
    if (!user && profile) {
      setUser({
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        mustChangePassword: profile.mustChangePassword,
      });
    }
  }, [user, profile, setUser]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Đang tải...
      </div>
    );
  }

  if (user.role === 'PATIENT') {
    return <PatientSiteShell>{children}</PatientSiteShell>;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
