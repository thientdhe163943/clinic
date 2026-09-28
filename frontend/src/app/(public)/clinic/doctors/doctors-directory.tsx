'use client';

import { useState } from 'react';
import { Briefcase, CalendarPlus, GraduationCap, Search, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { useHasMounted } from '@/hooks/use-has-mounted';
import { usePublicDoctors } from '@/hooks/use-public-doctors';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';
import { cn } from '@/lib/utils/cn';

export function DoctorsDirectory() {
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const hasMounted = useHasMounted();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [specialtyId, setSpecialtyId] = useState(searchParams.get('specialtyId') ?? '');

  const { data: clinicInfo } = useClinicInfo();
  const specialties = clinicInfo?.specialties ?? [];

  const {
    data: doctors,
    isLoading,
    error,
  } = usePublicDoctors({ search: search || undefined, specialtyId: specialtyId || undefined });

  return (
    <div>
      <div className="relative mt-6 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm bác sĩ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Pill-style specialty filter chips, matching the reference mockup —
          replaces the previous dropdown Select. */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSpecialtyId('')}
          className={cn(
            'h-9 rounded-full px-4 text-sm font-medium transition-colors',
            specialtyId === ''
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-muted',
          )}
        >
          Tất cả
        </button>
        {specialties.map((specialty) => (
          <button
            key={specialty.id}
            type="button"
            onClick={() => setSpecialtyId(specialty.id)}
            className={cn(
              'h-9 rounded-full px-4 text-sm font-medium transition-colors',
              specialtyId === specialty.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-muted',
            )}
          >
            {specialty.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-6 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          Đang tải danh sách bác sĩ...
        </p>
      ) : error ? (
        <p className="mt-6 rounded-md bg-destructive/10 p-6 text-center text-sm text-destructive">
          Không thể tải danh sách bác sĩ.
        </p>
      ) : !doctors?.length ? (
        <p className="mt-6 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          {search || specialtyId ? 'Không tìm thấy bác sĩ phù hợp.' : 'Chưa có thông tin bác sĩ khả dụng.'}
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((doctor) => (
            <Card key={doctor.id} className="overflow-hidden transition-transform hover:-translate-y-1">
              <Link href={`/clinic/doctors/${doctor.id}`}>
                <div
                  className="aspect-[3/4] w-full bg-muted bg-cover bg-center"
                  style={doctor.avatarUrl ? { backgroundImage: `url(${resolveAvatarUrl(doctor.avatarUrl)})` } : undefined}
                >
                  {!doctor.avatarUrl && (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300">
                      <Stethoscope className="h-16 w-16" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-5">
                <Link href={`/clinic/doctors/${doctor.id}`}>
                  <h3 className="text-lg font-bold text-foreground hover:text-primary">{doctor.fullName}</h3>
                </Link>
                <p className="mt-1 text-sm font-medium text-primary">
                  {doctor.specialtyName ?? 'Chưa cập nhật chuyên khoa'}
                </p>
                <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-5 text-muted-foreground">
                  {doctor.biography ?? 'Thông tin mô tả đang được cập nhật.'}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4 shrink-0 text-accent" />
                    {doctor.yearsExperience ?? 0} năm kinh nghiệm
                  </span>
                  {doctor.degree && (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 shrink-0 text-accent" />
                      {doctor.degree}
                    </span>
                  )}
                </div>

                <a
                  className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-primary text-sm font-medium text-primary transition-colors hover:bg-secondary"
                  href={hasMounted && isAuthenticated ? '/book-appointment' : '/guest-booking'}
                >
                  <CalendarPlus className="h-4 w-4" />
                  Đặt Lịch Khám
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
