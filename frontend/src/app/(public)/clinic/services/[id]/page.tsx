import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PatientSiteShell } from '@/components/shared/patient-site-shell';
import { publicServicesApi } from '@/lib/api/endpoints/public-services';
import { ServiceDetail } from './service-detail';

interface ServicePageProps {
  params: { id: string };
}

async function findService(id: string) {
  try {
    const services = await publicServicesApi.list();
    return services.find((service) => service.id === id) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const service = await findService(params.id);
  if (!service) {
    return { title: 'Dịch vụ | Phòng Khám Đa Khoa Âu Cơ Phú Hà' };
  }
  return {
    title: `${service.name} | Phòng Khám Đa Khoa Âu Cơ Phú Hà`,
    description: service.description ?? `Thông tin dịch vụ ${service.name}, bảng giá và câu hỏi thường gặp.`,
  };
}

export default async function ServicePage({ params }: ServicePageProps) {
  const service = await findService(params.id);
  if (!service) notFound();

  return (
    <PatientSiteShell
      breadcrumb={[{ label: 'Dịch vụ', href: '/clinic/services' }, { label: service.name }]}
    >
      <ServiceDetail id={params.id} />
    </PatientSiteShell>
  );
}
