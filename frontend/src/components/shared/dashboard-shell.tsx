'use client';

import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  Home,
  IdCard,
  LayoutDashboard,
  LogOut,
  Package,
  Pill,
  Receipt,
  Settings,
  ShieldCheck,
  Stethoscope,
  Tag,
  Truck,
  Users,
} from 'lucide-react';
import { ROLE_HOME } from '@/lib/auth/routes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useAuth } from '@/hooks/use-auth';
import { useScheduleEvents } from '@/hooks/use-schedule-events';
import type { NavItem } from '@/types/navigation';

const navItems: NavItem[] = [
  { href: ROLE_HOME.ADMIN, label: 'Tổng quan', icon: LayoutDashboard, roles: ['ADMIN'] },
  { href: '/admin/users', label: 'Người dùng', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/specialties', label: 'Chuyên khoa', icon: Stethoscope, roles: ['ADMIN'] },
  { href: '/admin/doctor-specialties', label: 'Chuyên khoa BS', icon: IdCard, roles: ['ADMIN'] },
  { href: '/admin/services', label: 'Dịch vụ', icon: Tag, roles: ['ADMIN'] },
  { href: '/admin/patients', label: 'Bệnh nhân', icon: Users, roles: ['ADMIN'] },
  { href: '/medical-record', label: 'Bệnh án', icon: FileText, roles: ['ADMIN'] },
  { href: '/admin/rooms', label: 'Phòng', icon: Home, roles: ['ADMIN'] },
  { href: '/admin/cls-rooms', label: 'Phòng CLS', icon: FlaskConical, roles: ['ADMIN'] },
  { href: '/admin/schedules', label: 'Lịch làm việc', icon: CalendarDays, roles: ['ADMIN'] },
  { href: '/admin/supplies', label: 'Vật tư', icon: Package, roles: ['ADMIN'] },
  { href: '/admin/medicines', label: 'Thuốc', icon: Pill, roles: ['ADMIN'] },
  { href: '/admin/suppliers', label: 'Nhà cung cấp', icon: Truck, roles: ['ADMIN'] },
  { href: '/admin/logs', label: 'System logs', icon: ShieldCheck, roles: ['ADMIN'] },
  { href: ROLE_HOME.RECEPTIONIST, label: 'Tổng quan', icon: LayoutDashboard, roles: ['RECEPTIONIST'] },
  { href: '/receptionist/appointments', label: 'Lịch hẹn', icon: ClipboardList, roles: ['RECEPTIONIST'] },
  { href: '/receptionist/patients', label: 'Bệnh nhân', icon: Users, roles: ['RECEPTIONIST'] },
  { href: '/medical-record', label: 'Bệnh án', icon: FileText, roles: ['RECEPTIONIST'] },
  { href: '/receptionist/invoices', label: 'Hóa đơn', icon: Receipt, roles: ['RECEPTIONIST'] },
  { href: '/receptionist/schedule', label: 'Lịch làm việc', icon: CalendarDays, roles: ['RECEPTIONIST'] },
  { href: ROLE_HOME.DOCTOR, label: 'Tổng quan', icon: LayoutDashboard, roles: ['DOCTOR'] },
  { href: '/doctor/visits', label: 'Lượt khám', icon: Stethoscope, roles: ['DOCTOR'] },
  { href: '/doctor/medical-records', label: 'Bệnh án', icon: FileText, roles: ['DOCTOR'] },
  { href: '/doctor/schedule', label: 'Lịch bác sĩ', icon: CalendarDays, roles: ['DOCTOR'] },
  { href: '/doctor/specialty', label: 'Chuyên khoa', icon: IdCard, roles: ['DOCTOR'] },
  { href: ROLE_HOME.NURSE, label: 'Tổng quan', icon: LayoutDashboard, roles: ['NURSE'] },
  { href: '/nurse/queue', label: 'Hàng đợi', icon: Activity, roles: ['NURSE'] },
  { href: '/nurse/schedule', label: 'Lịch làm việc', icon: CalendarDays, roles: ['NURSE'] },
  { href: ROLE_HOME.LAB_TECH, label: 'Tổng quan', icon: LayoutDashboard, roles: ['LAB_TECH'] },
  { href: '/lab/cls-orders', label: 'Phiếu CLS', icon: FlaskConical, roles: ['LAB_TECH'] },
  { href: '/lab/schedule', label: 'Lịch làm việc', icon: CalendarDays, roles: ['LAB_TECH'] },
  { href: '/clinic', label: 'Phòng khám', icon: LayoutDashboard, roles: ['PATIENT'] },
  { href: '/results', label: 'Tra cứu KQ', icon: FileText, roles: ['PATIENT'] },
  { href: '/my-medical-record', label: 'Hồ sơ bệnh án', icon: ClipboardList, roles: ['PATIENT'] },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const role = user?.role ?? 'ADMIN';
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  // Version-up 0.2 Phase 2 #9 tình huống B — ADMIN reassigns a doctor off a
  // shift and it emits `schedule:doctor-reassigned` to the RECEPTIONIST role
  // room and to the substitute doctor's own userId room. This shell is
  // mounted for every non-PATIENT role (PATIENT uses PatientSiteShell
  // instead — see (dashboard)/layout.tsx), so mounting the listener once
  // here covers ADMIN/RECEPTIONIST/DOCTOR without a per-role branch; a role
  // that never gets the event server-side just never has its handler fire.
  useScheduleEvents();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background md:grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-white">
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Clinic System</p>
            <p className="text-xs text-muted-foreground">{role}</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {visibleItems.map((item) => {
            const active =
              item.href === ROLE_HOME[role] ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-border bg-white px-5">
          <div>
            <p className="text-sm font-medium">{user?.fullName ?? 'Admin'}</p>
            <p className="text-xs text-muted-foreground">{user?.email ?? 'admin@gmail.com'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/profile">
              <Button size="icon" variant="ghost" aria-label="Settings">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            <Button size="icon" variant="ghost" aria-label="Logout" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
