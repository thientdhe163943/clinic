import type { Metadata } from 'next';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { clinicInfoApi } from '@/lib/api/endpoints/clinic-info';
import { DepartmentDetail } from './department-detail';

interface DepartmentPageProps {
  params: { id: string };
}

async function findSpecialty(id: string) {
  try {
    const clinicInfo = await clinicInfoApi.get();
    return clinicInfo.specialties.find((specialty) => specialty.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: DepartmentPageProps): Promise<Metadata> {
  const specialty = await findSpecialty(params.id);
  if (!specialty) {
    return { title: 'Chuyên khoa | Phòng Khám Đa Khoa Âu Cơ Phú Hà' };
  }
  return {
    title: `${specialty.name} | Phòng Khám Đa Khoa Âu Cơ Phú Hà`,
    description: specialty.description ?? `Thông tin chuyên khoa ${specialty.name}, bác sĩ và dịch vụ liên quan.`,
  };
}

export default async function DepartmentPage({ params }: DepartmentPageProps) {
  const specialty = await findSpecialty(params.id);

  return (
    <PatientSiteShell
      breadcrumb={[{ label: 'Chuyên khoa', href: '/clinic/departments' }, { label: specialty?.name ?? 'Chi tiết' }]}
    >
      <DepartmentDetail id={params.id} />
    </PatientSiteShell>
  );
}
