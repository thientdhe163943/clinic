'use client';

import { Award, CalendarPlus, Clock, GraduationCap, Star, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { usePublicDoctor } from '@/hooks/use-public-doctors';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';

export function DoctorProfile({ id }: { id: string }) {
  const { isAuthenticated } = useAuth();
  const hasMounted = useHasMounted();
  const showAuthenticatedUI = hasMounted && isAuthenticated;

  const { data: doctor, isLoading, error } = usePublicDoctor(id);
  const { data: clinicInfo } = useClinicInfo();

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl p-5 py-12">
        <p className="rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          Đang tải hồ sơ bác sĩ...
        </p>
      </section>
    );
  }

  if (error || !doctor) {
    return (
      <section className="mx-auto max-w-6xl p-5 py-12 text-center">
        <p className="text-lg font-semibold text-foreground">Không thể tải hồ sơ bác sĩ</p>
        <Link href="/clinic/doctors" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
          ← Quay lại danh sách bác sĩ
        </Link>
      </section>
    );
  }

  const bookingHref = showAuthenticatedUI ? '/book-appointment' : '/guest-booking';

  return (
    <section className="mx-auto max-w-6xl p-5 py-12">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <div>
          <Card className="overflow-hidden">
            <div
              className="aspect-square w-full bg-muted bg-cover bg-center"
              style={doctor.avatarUrl ? { backgroundImage: `url(${resolveAvatarUrl(doctor.avatarUrl)})` } : undefined}
            >
              {!doctor.avatarUrl && (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300">
                  <Stethoscope className="h-24 w-24" />
                </div>
              )}
            </div>
            <div className="space-y-3 p-5 text-center">
              <h1 className="text-xl font-bold text-foreground">{doctor.fullName}</h1>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {doctor.specialtyName ?? 'Chưa cập nhật chuyên khoa'}
              </span>
              <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {doctor.yearsExperience ?? 0} năm kinh nghiệm
              </p>
              <Link
                href={bookingHref}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <CalendarPlus className="h-4 w-4" />
                Đặt Lịch Khám Cùng Bác Sĩ
              </Link>
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <GraduationCap className="h-5 w-5 text-primary" />
              Trình độ chuyên môn
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground">
                {doctor.degree ?? 'Chưa cập nhật'}
              </span>
              {doctor.subspecialty && (
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground">
                  {doctor.subspecialty}
                </span>
              )}
              {doctor.specialtyDescription && (
                <span className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground">
                  {doctor.specialtyDescription}
                </span>
              )}
            </div>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Award className="h-5 w-5 text-primary" />
              Kinh nghiệm
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {doctor.biography ?? 'Thông tin mô tả kinh nghiệm đang được cập nhật.'}
            </p>
          </div>

          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Lịch khám
            </h2>
            <Card className="mt-3 p-4">
              <p className="text-sm text-foreground">
                Giờ làm việc: {clinicInfo?.operatingHours ?? '07:00 - 17:30, tất cả các ngày trong tuần'}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Vui lòng đặt lịch trước để được lễ tân sắp xếp khung giờ khám phù hợp cùng bác sĩ.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
