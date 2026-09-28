'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Search, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { usePublicDoctors } from '@/hooks/use-public-doctors';
import { usePublicServices } from '@/hooks/use-public-services';

export function DepartmentsDirectory() {
  const [search, setSearch] = useState('');
  const { data: clinicInfo, isLoading } = useClinicInfo();
  const { data: doctors } = usePublicDoctors();
  const { data: services } = usePublicServices();

  const filtered = useMemo(() => {
    const specialties = clinicInfo?.specialties ?? [];
    return specialties.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));
  }, [clinicInfo?.specialties, search]);

  const doctorCountBySpecialty = useMemo(() => {
    const map = new Map<string, number>();
    for (const doctor of doctors ?? []) {
      if (!doctor.specialtyId) continue;
      map.set(doctor.specialtyId, (map.get(doctor.specialtyId) ?? 0) + 1);
    }
    return map;
  }, [doctors]);

  const serviceCountBySpecialty = useMemo(() => {
    const map = new Map<string, number>();
    for (const service of services ?? []) {
      if (!service.specialtyId) continue;
      map.set(service.specialtyId, (map.get(service.specialtyId) ?? 0) + 1);
    }
    return map;
  }, [services]);

  return (
    <div>
      <div className="mt-6 max-w-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm chuyên khoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-6 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          Đang tải danh sách chuyên khoa...
        </p>
      ) : !filtered.length ? (
        <p className="mt-6 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          Không tìm thấy chuyên khoa phù hợp.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((specialty) => (
            <Link key={specialty.id} href={`/clinic/departments/${specialty.id}`}>
              <Card className="flex h-full flex-col gap-3 p-5 transition-transform hover:-translate-y-1">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary-fixed text-primary">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{specialty.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {specialty.description ?? 'Đang cập nhật mô tả chuyên khoa.'}
                  </p>
                </div>
                <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                  <span>
                    {doctorCountBySpecialty.get(specialty.id) ?? 0} bác sĩ ·{' '}
                    {serviceCountBySpecialty.get(specialty.id) ?? 0} dịch vụ
                  </span>
                  <span className="flex items-center gap-1 font-medium text-primary">
                    Xem chi tiết <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
