'use client';

import { Award, Stethoscope, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import { usePublicDoctor } from '@/hooks/use-public-doctors';
import { useSchedules } from '@/hooks/use-schedules';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';
import { todayDateString } from '@/lib/utils/date';

// Version-up 0.2 Phase 4 #5 — read-only "xem nhanh" panel for a doctor,
// opened from the reception overview grid / appointments list instead of a
// full profile page. Only GET /public/doctors/:id + GET /schedules — no edit
// affordance anywhere (profile editing stays ADMIN-only elsewhere).

function formatPrice(price: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
}

function formatPriceRange(from: number | null, to: number | null) {
  if (from == null || to == null) return 'Liên hệ để biết giá khám';
  if (from === to) return formatPrice(from);
  return `${formatPrice(from)} - ${formatPrice(to)}`;
}

const shiftLabels: Record<string, string> = { MORNING: 'Sáng', AFTERNOON: 'Chiều', FULL_DAY: 'Cả ngày' };
const shiftVariant: Record<string, 'default' | 'warning' | 'success'> = {
  MORNING: 'default',
  AFTERNOON: 'warning',
  FULL_DAY: 'success',
};

interface DoctorQuickInfoPanelProps {
  /** userId của bác sĩ đang xem — null nghĩa là panel đang đóng. */
  doctorId: string | null;
  onClose: () => void;
}

export function DoctorQuickInfoPanel({ doctorId, onClose }: DoctorQuickInfoPanelProps) {
  const open = doctorId !== null;
  const { data: doctor, isLoading, error } = usePublicDoctor(doctorId, open);
  const todayStr = todayDateString();
  const { data: schedules = [], isLoading: schedulesLoading } = useSchedules(
    { userId: doctorId ?? undefined, from: todayStr, to: todayStr },
    open,
  );

  const avatarUrl = resolveAvatarUrl(doctor?.avatarUrl);

  return (
    <Dialog open={open} onClose={onClose} title="Thông tin bác sĩ">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải thông tin bác sĩ...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : doctor ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted bg-cover bg-center"
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            >
              {!avatarUrl && <UserIcon className="h-7 w-7 text-muted-foreground" />}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">{doctor.fullName}</p>
              {doctor.specialtyName && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Stethoscope className="h-3.5 w-3.5 shrink-0" /> {doctor.specialtyName}
                  {doctor.subspecialty ? ` · ${doctor.subspecialty}` : ''}
                </p>
              )}
              {doctor.yearsExperience != null && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Award className="h-3.5 w-3.5 shrink-0" /> {doctor.yearsExperience} năm kinh nghiệm
                  {doctor.degree ? ` · ${doctor.degree}` : ''}
                </p>
              )}
              <p className="mt-1 text-sm font-medium text-primary">
                {formatPriceRange(doctor.priceFrom, doctor.priceTo)}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Phòng / ca làm hôm nay</p>
            {schedulesLoading ? (
              <p className="text-sm text-muted-foreground">Đang tải lịch làm việc...</p>
            ) : schedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">Không có ca làm việc hôm nay.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {schedules.map((schedule) => (
                  <Badge
                    key={schedule.id}
                    variant={shiftVariant[schedule.shift] ?? 'default'}
                    title={`${shiftLabels[schedule.shift] ?? schedule.shift} · Phòng ${schedule.roomCode}`}
                  >
                    {shiftLabels[schedule.shift] ?? schedule.shift} · {schedule.roomCode}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
