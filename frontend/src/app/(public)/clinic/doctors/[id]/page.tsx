import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { publicDoctorsApi } from '@/lib/api/endpoints/public-doctors';
import { DoctorProfile } from './doctor-profile';

interface DoctorPageProps {
  params: { id: string };
}

async function findDoctor(id: string) {
  try {
    return await publicDoctorsApi.getById(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: DoctorPageProps): Promise<Metadata> {
  const doctor = await findDoctor(params.id);
  if (!doctor) {
    return { title: 'Bác sĩ | Phòng Khám Đa Khoa Âu Cơ Phú Hà' };
  }
  return {
    title: `${doctor.fullName} | Phòng Khám Đa Khoa Âu Cơ Phú Hà`,
    description: doctor.biography ?? `Hồ sơ chuyên môn bác sĩ ${doctor.fullName}, chuyên khoa ${doctor.specialtyName ?? ''}.`,
  };
}

export default async function DoctorPage({ params }: DoctorPageProps) {
  const doctor = await findDoctor(params.id);
  if (!doctor) notFound();

  return (
    <PatientSiteShell breadcrumb={[{ label: 'Bác sĩ', href: '/clinic/doctors' }, { label: doctor.fullName }]}>
      <DoctorProfile id={params.id} />
    </PatientSiteShell>
  );
}
