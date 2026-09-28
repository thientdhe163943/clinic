'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { Tabs } from '@/components/ui/tabs';
import { AppointmentDetailBody } from '@/components/shared/appointment-detail-body';
import { DoctorQuickInfoPanel } from '@/components/shared/doctor-quick-info-panel';
import { PageHeader } from '@/components/shared/page-header';
import { PendingAppointmentsSection } from '@/components/shared/pending-appointments-section';
import { ReceptionClinicBoard } from '@/components/shared/reception-clinic-board';
import { TodayAppointmentsSection } from '@/components/shared/today-appointments-section';
import { useAppointmentEvents } from '@/hooks/use-appointment-events';
import type { AppointmentStatus } from '@/types/appointments';

type AppointmentsTab = 'today' | 'pending' | 'rooms';

const APPOINTMENTS_TABS: { id: AppointmentsTab; label: string }[] = [
  { id: 'today', label: 'Lịch hẹn hôm nay' },
  { id: 'pending', label: 'Lịch hẹn chưa xác nhận' },
  { id: 'rooms', label: 'Danh sách lịch khám' },
];

// ─── Page ───────────────────────────────────────────────────────────────────
// Thin orchestrator only — each tab's own state, query and table markup
// lives in its own component (today-appointments-section.tsx /
// pending-appointments-section.tsx / reception-clinic-board.tsx), kept fully
// separate so a change to one tab can't accidentally break another.

export default function ReceptionistAppointmentsPage() {
  return (
    <Suspense fallback={null}>
      <ReceptionistAppointmentsContent />
    </Suspense>
  );
}

function ReceptionistAppointmentsContent() {
  // Live-refetch every tab's list when appointments change elsewhere
  // (patient self-booking, another receptionist, etc.) — see socket
  // contract in useAppointmentEvents. This is what makes "Lịch hẹn hôm nay"
  // a real-time board rather than a snapshot that needs a manual refresh.
  useAppointmentEvents();

  // Dashboard "Đang chờ xác nhận" card deep-links here with
  // ?status=PENDING — land straight on the matching tab instead of the
  // default "hôm nay" one.
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get('status') as AppointmentStatus | null) ?? '';
  const [activeTab, setActiveTab] = useState<AppointmentsTab>(initialStatus === 'PENDING' ? 'pending' : 'today');

  // Shared across tabs — only one of these overlays can be open at a time,
  // triggered from whichever tab's own table is currently rendered.
  const [quickInfoDoctorId, setQuickInfoDoctorId] = useState<string | null>(null);
  const [detailAppointmentId, setDetailAppointmentId] = useState<string | null>(null);

  const tabsElement = (
    <Tabs tabs={APPOINTMENTS_TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as AppointmentsTab)} />
  );

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Lịch hẹn"
        description="Đặt lịch, xác nhận, check-in và hủy lịch"
        action={
          <Link href="/receptionist/appointments/new">
            <Button>
              <Plus className="h-4 w-4" />
              Tạo lịch hẹn
            </Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        {/* The Tabs row is shared (one source of truth for the tab list) but
            rendered *inside* each tab's own content, right below its own
            search/filter bar — so it sits below the search row for every
            tab, "hôm nay", "chưa xác nhận" and "danh sách lịch khám" alike. */}
        {activeTab === 'today' && (
          <TodayAppointmentsSection
            tabsElement={tabsElement}
            onShowDoctor={setQuickInfoDoctorId}
            onShowDetail={setDetailAppointmentId}
          />
        )}
        {activeTab === 'pending' && (
          <PendingAppointmentsSection
            tabsElement={tabsElement}
            onShowDoctor={setQuickInfoDoctorId}
            onShowDetail={setDetailAppointmentId}
          />
        )}
        {activeTab === 'rooms' && <ReceptionClinicBoard tabsElement={tabsElement} />}
      </section>

      <DoctorQuickInfoPanel doctorId={quickInfoDoctorId} onClose={() => setQuickInfoDoctorId(null)} />

      <Drawer
        open={Boolean(detailAppointmentId)}
        onClose={() => setDetailAppointmentId(null)}
        title="Chi tiết lịch hẹn"
      >
        {detailAppointmentId && (
          <div className="space-y-4">
            <Link
              href={`/receptionist/appointments/${detailAppointmentId}`}
              className="text-xs text-primary hover:underline"
            >
              Mở trang đầy đủ ↗
            </Link>
            <AppointmentDetailBody appointmentId={detailAppointmentId} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
