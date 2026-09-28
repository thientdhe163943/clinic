import type { Metadata } from 'next';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { SectionHeading } from '@/components/shared/section-heading';
import { DepartmentsDirectory } from './departments-directory';

export const metadata: Metadata = {
  title: 'Chuyên khoa khám chữa bệnh | Phòng Khám Đa Khoa Âu Cơ Phú Hà',
  description:
    '10 chuyên khoa và phòng chức năng: Nội, Ngoại, Sản, Tai Mũi Họng, Mắt, Răng Hàm Mặt, X-Quang, Siêu âm, Xét nghiệm, Nội soi tiêu hóa.',
};

export default function DepartmentsPage() {
  return (
    <PatientSiteShell breadcrumb={[{ label: 'Chuyên khoa' }]}>
      <section className="mx-auto max-w-6xl p-5 py-12">
        <SectionHeading
          align="center"
          title="Các Chuyên Khoa Khám Chữa Bệnh"
          titleClassName="text-brand font-bold"
          description="Phòng khám có 10 chuyên khoa, phòng chức năng đáp ứng đa dạng nhu cầu khám và điều trị của người bệnh."
        />
        <DepartmentsDirectory />
      </section>
    </PatientSiteShell>
  );
}
