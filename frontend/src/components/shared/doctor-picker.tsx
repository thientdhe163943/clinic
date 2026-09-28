'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, Stethoscope, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { publicDoctorsApi } from '@/lib/api/endpoints/public-doctors';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';
import { cn } from '@/lib/utils/cn';
import type { AvailableDoctor } from '@/types/appointments';

function usePublicDoctorProfiles(specialtyId: string | null) {
  return useQuery({
    queryKey: ['public-doctors', 'by-specialty', specialtyId],
    queryFn: () => publicDoctorsApi.list({ specialtyId: specialtyId ?? undefined }),
    enabled: Boolean(specialtyId),
  });
}

interface DoctorPickerProps {
  doctorOptions: AvailableDoctor[];
  specialtyId: string | null;
  value: string;
  onChange: (doctorId: string) => void;
}

// Replaces the plain <select> of doctor names with profile cards (avatar,
// specialty, experience, bio) merged in from the public doctor directory —
// lets a patient/receptionist actually pick a *preferred* doctor instead of
// choosing a name blind. Only shows doctors who both match the service's
// specialty (public profile) AND have a real slot that day (availableDoctors,
// already date+service scoped) — a doctor without either isn't bookable.
export function DoctorPicker({ doctorOptions, specialtyId, value, onChange }: DoctorPickerProps) {
  const { data: profiles } = usePublicDoctorProfiles(specialtyId);

  const profileById = new Map((profiles ?? []).map((profile) => [profile.userId, profile]));

  if (doctorOptions.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có bác sĩ phù hợp trong ngày này.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {doctorOptions.map((doctor) => {
        const profile = profileById.get(doctor.doctorId);
        const isSelected = value === doctor.doctorId;
        const totalSlots = doctor.shifts.reduce(
          (sum, shift) => sum + shift.slots.filter((slot) => slot.available).length,
          0,
        );
        const avatarUrl = resolveAvatarUrl(profile?.avatarUrl);

        return (
          <Card
            key={doctor.doctorId}
            role="button"
            tabIndex={0}
            onClick={() => onChange(doctor.doctorId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') onChange(doctor.doctorId);
            }}
            className={cn(
              'cursor-pointer p-4 transition-colors',
              isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/50',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted bg-cover bg-center"
                style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
              >
                {!avatarUrl && <UserIcon className="h-6 w-6 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{doctor.doctorName}</p>
                {profile?.specialtyName && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Stethoscope className="h-3 w-3 shrink-0" /> {profile.specialtyName}
                  </p>
                )}
                {profile?.degree && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Award className="h-3 w-3 shrink-0" />
                    {profile.degree}
                    {profile.yearsExperience != null ? ` · ${profile.yearsExperience} năm kinh nghiệm` : ''}
                  </p>
                )}
              </div>
            </div>
            {profile?.biography && (
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{profile.biography}</p>
            )}
            <div className="mt-3">
              <Badge variant={totalSlots > 0 ? 'success' : 'muted'}>{totalSlots} khung giờ trống</Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
