import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { SectionHeading } from '@/components/shared/section-heading';
import { ServicesDirectory } from './services-directory';

export const metadata: Metadata = {
  title: 'Dịch vụ & bảng giá | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description: 'Tra cứu dịch vụ khám chữa bệnh theo chuyên khoa và bảng giá công khai, minh bạch.',
};

export default function ServicesPage() {
  return (
    <PatientSiteShell breadcrumb={[{ label: 'Dịch vụ' }]}>
      <section className="bg-primary-fixed/60">
        <div className="mx-auto max-w-6xl px-5 py-12 text-center">
          <SectionHeading
            align="center"
            title="Các Dịch Vụ Nổi Bật"
            titleClassName="text-brand font-bold"
            description="Phòng Khám Đa Khoa Âu Cơ Phú Hà cung cấp đa dạng các dịch vụ khám chữa bệnh theo chuyên khoa, với bảng giá công khai, minh bạch."
          />
        </div>
      </section>
      <section className="mx-auto max-w-6xl p-5 py-10">
        <Suspense fallback={null}>
          <ServicesDirectory />
        </Suspense>
      </section>
    </PatientSiteShell>
  );
}
