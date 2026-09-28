'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, Stethoscope, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useClinicInfo } from '@/hooks/use-clinic-info';
import { usePublicDoctors } from '@/hooks/use-public-doctors';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';
import { cn } from '@/lib/utils/cn';
import type { PublicDoctorListItem } from '@/types/public-doctors';

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function formatPriceRange(from: number | null, to: number | null) {
  if (from == null || to == null) return 'Liên hệ để biết giá khám';
  if (from === to) return formatPrice(from);
  return `${formatPrice(from)} - ${formatPrice(to)}`;
}

interface DoctorSearchListProps {
  /** Currently selected doctor's userId (matches AvailableDoctor.doctorId), or ''. */
  value: string;
  onSelect: (doctor: PublicDoctorListItem) => void;
  /** Locks the list to doctors in the selected service's specialty. */
  specialtyId?: string;
  showSpecialtyFilter?: boolean;
  filterControl?: ReactNode;
}

// Searchable doctor list used after a service is selected. When specialtyId
// is supplied, results are locked to that service's specialty; other callers
// can still use the optional specialty filter. The whole card is selectable
// by pointer or keyboard.
export function DoctorSearchList({
  value,
  onSelect,
  specialtyId,
  showSpecialtyFilter = true,
  filterControl,
}: DoctorSearchListProps) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: clinicInfo } = useClinicInfo();
  const specialties = clinicInfo?.specialties ?? [];

  const { data: doctors, isLoading, isFetching } = usePublicDoctors({
    search: debounced || undefined,
    specialtyId: specialtyId || specialtyFilter || undefined,
  });
  const loading = isLoading || isFetching;

  // Issue 2: shows a bottom fade while the list has more content below the
  // visible scroll area — recomputed on scroll and whenever the doctor list
  // itself changes size (new search/filter results).
  const updateScrollFade = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };

  useEffect(() => {
    updateScrollFade();
  }, [doctors]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm bác sĩ theo tên..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        {!specialtyId && showSpecialtyFilter && (
          <Select
            value={specialtyFilter}
            onChange={(event) => setSpecialtyFilter(event.target.value)}
            className="sm:w-56"
          >
            <option value="">Tất cả chuyên khoa</option>
            {specialties.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </Select>
        )}
        {filterControl}
      </div>

      {!loading && <Badge variant="default">Tìm thấy {doctors?.length ?? 0} bác sĩ phù hợp</Badge>}

      {loading ? (
        <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
          Đang tải danh sách bác sĩ...
        </p>
      ) : !doctors?.length ? (
        <p className="rounded-md bg-muted p-4 text-center text-sm text-muted-foreground">
          Không tìm thấy bác sĩ phù hợp.
        </p>
      ) : (
        <div className="relative">
          <div
            ref={scrollRef}
            onScroll={updateScrollFade}
            className="grid max-h-[30rem] grid-cols-1 gap-4 overflow-y-auto p-1 sm:grid-cols-2"
          >
            {doctors.map((doctor) => {
              const isSelected = value === doctor.userId;
              const avatarUrl = resolveAvatarUrl(doctor.avatarUrl);
              return (
                <Card
                  key={doctor.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(doctor)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect(doctor);
                    }
                  }}
                  className={cn(
                    'flex min-w-0 cursor-pointer flex-col gap-4 border-2 p-4 transition-[border-color,background-color,box-shadow] hover:border-primary/60 hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none',
                    isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted bg-cover bg-center"
                      style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
                    >
                      {!avatarUrl && <UserIcon className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    {/* Full card width for the name/specialty column — a 2-up
                        grid card is too narrow to also fit avatar+price+button
                        on the same row without truncating longer doctor names. */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-foreground">{doctor.fullName}</p>
                      {doctor.specialtyName && (
                        <Badge
                          variant="default"
                          className="mt-1 flex h-auto min-h-6 max-w-full w-fit items-start gap-1 py-1"
                        >
                          <Stethoscope className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="min-w-0 whitespace-normal break-words leading-4">
                            {doctor.specialtyName}
                          </span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-auto border-t border-border pt-2">
                    <p className="text-xs font-medium text-primary">
                      {formatPriceRange(doctor.priceFrom, doctor.priceTo)}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
          {canScrollMore && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-1 h-8 bg-gradient-to-t from-white to-transparent" />
          )}
        </div>
      )}
    </div>
  );
}
