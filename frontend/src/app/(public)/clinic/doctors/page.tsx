import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { SectionHeading } from '@/components/shared/section-heading';
import { DoctorsDirectory } from './doctors-directory';

export const metadata: Metadata = {
  title: 'Đội ngũ bác sĩ | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description: 'Đội ngũ bác sĩ chuyên khoa I và sau đại học giàu kinh nghiệm tại Phòng Khám Đa Khoa Âu Cơ Phú Hà.',
};

export default function DoctorsPage() {
  return (
    <PatientSiteShell breadcrumb={[{ label: 'Bác sĩ' }]}>
      <section className="mx-auto max-w-6xl p-5 py-12">
        <SectionHeading
          align="center"
          title="Đội ngũ Bác sĩ Chuyên gia"
          titleClassName="text-brand font-bold"
          description="Tìm bác sĩ theo tên hoặc chuyên khoa để xem hồ sơ chi tiết và đặt lịch khám."
        />
        <Suspense fallback={null}>
          <DoctorsDirectory />
        </Suspense>
      </section>
    </PatientSiteShell>
  );
}
