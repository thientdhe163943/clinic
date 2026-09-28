'use client';

import { useMemo } from 'react';
import { CalendarCheck, ClipboardList, Receipt, Users } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { useAppointmentEvents } from '@/hooks/use-appointment-events';
import { useAppointments } from '@/hooks/use-appointments';
import { useAuth } from '@/hooks/use-auth';
import { useInvoices } from '@/hooks/use-invoices';
import { usePatients } from '@/hooks/use-patients';

const quickLinks = [
  { href: '/receptionist/appointments', label: 'Lịch hẹn', icon: ClipboardList },
  { href: '/receptionist/patients', label: 'Bệnh nhân', icon: Users },
  { href: '/receptionist/invoices', label: 'Hóa đơn', icon: Receipt },
];

// Local (not UTC) today — toISOString() would roll back to the previous
// calendar day in Vietnam's UTC+7 during 00:00-06:59 local time.
function today() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const MONTH_LABELS = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

// Same "Hôm nay, D Tháng M" phrasing as the other dashboards (doctor/nurse/
// lab/admin) — each page keeps its own local copy per the codebase's
// existing per-page today()-helper convention.
function todayHeaderLabel(): string {
  const now = new Date();
  return `Hôm nay, ${now.getDate()} ${MONTH_LABELS[now.getMonth()]}`;
}

export default function ReceptionistHomePage() {
  const { user } = useAuth();
  const todayStr = useMemo(() => today(), []);

  // Live-refetch the stat cards whenever an appointment changes elsewhere
  // (patient online booking, another receptionist) — same socket-driven
  // pattern as /receptionist/appointments.
  useAppointmentEvents();

  // Single date-scoped fetch (limit 100, PaginationDto's hard ceiling) powers
  // every appointment-derived stat card below — no additional /appointments
  // calls just to get counts (version-up 0.2 #4).
  const { data: todayAppointments } = useAppointments({ date: todayStr, limit: 100 });

  const { data: unpaidInvoices } = useInvoices({ paymentStatus: 'UNPAID', limit: 1 });
  // No server-side "created today" filter on patients — page through the
  // most recent 100 (PaginationDto's hard ceiling) and filter client-side.
  // Fine for a clinic's realistic daily new-patient volume; would undercount
  // only if more than 100 patients were created across the whole clinic today.
  const { data: recentPatients } = usePatients({ limit: 100 });
  const newPatientsToday = (recentPatients?.items ?? []).filter((p) => p.createdAt.startsWith(todayStr)).length;

  // Appointment counts, computed client-side from the single date-scoped
  // fetch above (meta.total for the true daily count; item-array filtering
  // for the rest — undercounts only past that 100-row volume in a single day).
  const todayItems = todayAppointments?.items ?? [];
  const pendingCount = todayItems.filter((a) => a.status === 'PENDING').length;

  return (
    <main>
      <PageHeader
        title={`Chào lễ tân${user?.fullName ? `, ${user.fullName}` : ''}`}
        description={todayHeaderLabel()}
      />
      {/* "Việc cần xử lý" — clickable work-queue cards where a real, working
          filtered destination exists. "Bệnh nhân mới" and "Hóa đơn chưa
          thanh toán" stay informational-only: patients has no "created
          today" filter, and the invoices list deliberately shows nothing
          until a search term is typed (an existing, intentional business
          rule — see receptionist/invoices/page.tsx), so a status-only deep
          link would land on an empty page. */}
      <section className="grid gap-4 p-5 md:grid-cols-4">
        <Link href="/receptionist/appointments" className="block transition-transform hover:-translate-y-0.5">
          <StatCard icon={CalendarCheck} label="Lịch hẹn hôm nay" value={String(todayAppointments?.meta.total ?? 0)} tone="blue" />
        </Link>
        <Link
          href="/receptionist/appointments?status=PENDING"
          className="block transition-transform hover:-translate-y-0.5"
        >
          <StatCard icon={ClipboardList} label="Đang chờ xác nhận" value={String(pendingCount)} tone="amber" />
        </Link>
        <StatCard icon={Users} label="Bệnh nhân mới" value={String(newPatientsToday)} tone="teal" />
        <StatCard icon={Receipt} label="Hóa đơn chưa thanh toán" value={String(unpaidInvoices?.meta.total ?? 0)} tone="red" />
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
