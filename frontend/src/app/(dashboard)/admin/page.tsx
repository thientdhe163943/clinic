'use client';

import { useMemo } from 'react';
import { CalendarDays, Home, Package, Pill, ShieldCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { useAuth } from '@/hooks/use-auth';
import { useRooms } from '@/hooks/use-rooms';
import { useSchedules } from '@/hooks/use-schedules';
import { useSupplyList } from '@/hooks/use-supplies';

const quickLinks = [
  { href: '/admin/users', label: 'Quản lý người dùng', icon: Users },
  { href: '/admin/rooms', label: 'Quản lý phòng', icon: Home },
  { href: '/admin/schedules', label: 'Lịch làm việc', icon: CalendarDays },
  { href: '/admin/supplies', label: 'Vật tư', icon: Package },
  { href: '/admin/medicines', label: 'Thuốc', icon: Pill },
  { href: '/admin/logs', label: 'System logs', icon: ShieldCheck },
];

// date.toLocaleDateString('en-CA') gives YYYY-MM-DD in local time (not
// date.toISOString(), which converts to UTC first and can roll back to the
// previous calendar day in Vietnam's UTC+7).
function startOfWeekStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday-start week
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  return monday.toLocaleDateString('en-CA');
}

function endOfWeekStr(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + diff);
  return sunday.toLocaleDateString('en-CA');
}

const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// Same "Hôm nay, D Tháng M" phrasing as doctor/page.tsx — no shared
// formatter produces this exact string, each dashboard page defines its
// own local copy (existing convention, see the today()-style helpers above).
function todayHeaderLabel(): string {
  const now = new Date();
  return `Hôm nay, ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

export default function AdminHomePage() {
  const { user } = useAuth();
  const weekRange = useMemo(() => ({ from: startOfWeekStr(), to: endOfWeekStr() }), []);

  const { data: usersData } = useAdminUsers({ limit: 1 });
  const { data: rooms } = useRooms();
  const { data: weekSchedules } = useSchedules(weekRange);
  const { data: lowStockSupplies } = useSupplyList({ status: 'LOW_STOCK', limit: 1 });

  const activeRoomCount = (rooms ?? []).filter((r) => r.status === 'ACTIVE').length;

  return (
    <main>
      <PageHeader
        title={`Chào Admin${user?.fullName ? `, ${user.fullName}` : ''}`}
        description={todayHeaderLabel()}
      />
      <section className="grid gap-4 p-5 md:grid-cols-4">
        <StatCard icon={Users} label="Tổng tài khoản" value={String(usersData?.meta.total ?? 0)} tone="blue" />
        <StatCard icon={Home} label="Phòng đang hoạt động" value={String(activeRoomCount)} tone="teal" />
        <StatCard icon={CalendarDays} label="Lịch làm việc tuần này" value={String(weekSchedules?.length ?? 0)} tone="amber" />
        <StatCard icon={Package} label="Vật tư sắp hết" value={String(lowStockSupplies?.meta.total ?? 0)} tone="red" />
      </section>
      <section className="grid gap-4 p-5 pt-0 md:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-medium">{item.label}</p>
              </Card>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
