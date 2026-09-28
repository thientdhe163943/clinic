'use client';

import { CalendarPlus, Star, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { SectionHeading } from '@/components/shared/section-heading';
import { Card } from '@/components/ui/card';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { usePublicDoctors } from '@/hooks/use-public-doctors';
import { usePublicServices } from '@/hooks/use-public-services';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

export function DepartmentDetail({ id }: { id: string }) {
  const { data: clinicInfo, isLoading: isClinicInfoLoading } = useClinicInfo();
  const specialty = clinicInfo?.specialties.find((s) => s.id === id);

  const { data: doctors, isLoading: isDoctorsLoading } = usePublicDoctors({ specialtyId: id });
  const { data: services, isLoading: isServicesLoading } = usePublicServices({ specialtyId: id });

  if (isClinicInfoLoading) {
    return (
      <section className="mx-auto max-w-6xl p-5 py-12">
        <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">Đang tải thông tin...</p>
      </section>
    );
  }

  if (!specialty) {
    return (
      <section className="mx-auto max-w-6xl p-5 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">Không tìm thấy chuyên khoa</p>
        <p className="mt-2 text-sm text-muted-foreground">Chuyên khoa này có thể đã ngừng hoạt động hoặc đổi tên.</p>
        <Link href="/clinic/departments" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          ← Quay lại danh sách chuyên khoa
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="border-b border-border bg-gradient-to-br from-primary/5 to-blue-500/5 px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Stethoscope className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{specialty.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {specialty.description ?? 'Đội ngũ bác sĩ chuyên khoa giàu kinh nghiệm, trang thiết bị hiện đại, phục vụ nhu cầu khám và điều trị chuyên sâu.'}
            </p>
          </div>
        </div>
      </section>

      {/* Related doctors */}
      <section className="mx-auto max-w-6xl p-5 py-12">
        <SectionHeading
          eyebrow="Đội ngũ"
          title={`Bác sĩ chuyên khoa ${specialty.name}`}
          action={
            <Link
              href="/guest-booking"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <CalendarPlus className="h-4 w-4" />
              Đặt lịch khám
            </Link>
          }
        />

        {isDoctorsLoading ? (
          <p className="mt-4 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">Đang tải...</p>
        ) : !doctors?.length ? (
          <p className="mt-4 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
            Chưa có bác sĩ được gán cho chuyên khoa này.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {doctors.map((doctor) => (
              <Link key={doctor.id} href={`/clinic/doctors/${doctor.id}`}>
                <Card className="flex h-full flex-col overflow-hidden text-center transition-shadow hover:shadow-md">
                  <div
                    className="aspect-[4/3] w-full bg-muted bg-cover bg-center"
                    style={doctor.avatarUrl ? { backgroundImage: `url(${resolveAvatarUrl(doctor.avatarUrl)})` } : undefined}
                  >
                    {!doctor.avatarUrl && (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300">
                        <Stethoscope className="h-14 w-14" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col items-center p-5">
                    <h3 className="text-base font-bold text-foreground">{doctor.fullName}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {doctor.yearsExperience ?? 0} năm kinh nghiệm
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Treatments / services */}
      <section className="border-t border-border bg-secondary/30 px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <SectionHeading eyebrow="Điều trị" title="Dịch vụ & danh mục điều trị" />

          {isServicesLoading ? (
            <p className="mt-4 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">Đang tải...</p>
          ) : !services?.length ? (
            <p className="mt-4 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
              Chưa có dịch vụ được gán cho chuyên khoa này.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {services.map((service) => (
                <Link key={service.id} href={`/clinic/services/${service.id}`}>
                  <Card className="flex h-full flex-col gap-1 p-4 transition-shadow hover:shadow-md">
                    <p className="text-sm font-semibold text-foreground">{service.name}</p>
                    <p className="mt-2 text-base font-bold text-primary">{formatPrice(service.price)}</p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
