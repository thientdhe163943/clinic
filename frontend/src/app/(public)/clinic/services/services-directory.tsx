'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, Search, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { usePublicServices } from '@/hooks/use-public-services';
import type { PublicServiceListItem } from '@/types/public-services';

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function groupByCategory(services: PublicServiceListItem[]) {
  const groups = new Map<string, PublicServiceListItem[]>();
  for (const service of services) {
    const key = service.specialtyName ?? 'Dịch vụ khác';
    const list = groups.get(key) ?? [];
    list.push(service);
    groups.set(key, list);
  }
  return Array.from(groups.entries());
}

export function ServicesDirectory() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [specialtyId, setSpecialtyId] = useState(searchParams.get('specialtyId') ?? '');

  const { data: clinicInfo } = useClinicInfo();
  const specialties = clinicInfo?.specialties ?? [];

  const {
    data: services,
    isLoading,
    error,
  } = usePublicServices({ search: search || undefined, specialtyId: specialtyId || undefined });

  const grouped = useMemo(() => groupByCategory(services ?? []), [services]);

  return (
    <div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên dịch vụ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)} className="sm:w-64">
          <option value="">Tất cả chuyên khoa</option>
          {specialties.map((specialty) => (
            <option key={specialty.id} value={specialty.id}>
              {specialty.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <p className="mt-6 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          Đang tải danh sách dịch vụ...
        </p>
      ) : error ? (
        <p className="mt-6 rounded-md bg-destructive/10 p-6 text-center text-sm text-destructive">
          Không thể tải danh sách dịch vụ.
        </p>
      ) : !grouped.length ? (
        <p className="mt-6 rounded-md bg-muted p-6 text-center text-sm text-muted-foreground">
          Không tìm thấy dịch vụ phù hợp.
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h2 className="text-lg font-bold text-foreground">{category}</h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-2 md:grid-cols-3">
                {items.map((service) => (
                  <Link key={service.id} href={`/clinic/services/${service.id}`}>
                    <Card className="flex h-full flex-col overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-md">
                      <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-primary-fixed to-primary-fixed/50 text-primary/40">
                        <Stethoscope className="h-12 w-12" />
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-base font-bold text-foreground">{service.name}</p>
                        <p className="mt-1.5 line-clamp-2 min-h-[36px] text-sm leading-5 text-muted-foreground">
                          {service.description ?? (service.serviceCode ? `Mã DV: ${service.serviceCode}` : 'Thông tin mô tả đang được cập nhật.')}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-3">
                          <p className="text-sm font-bold text-brand-red">{formatPrice(service.price)}</p>
                          <span className="flex items-center gap-1 text-sm font-medium text-primary">
                            Tư vấn ngay <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
