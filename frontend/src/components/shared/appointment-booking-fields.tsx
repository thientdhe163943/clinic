'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { AppointmentDatePicker, formatDisplayDate } from '@/components/shared/appointment-date-picker';
import { DoctorSearchList } from '@/components/shared/doctor-search-list';
import { TimeSlotGrid } from '@/components/shared/time-slot-grid';
import { TimeWheelPicker } from '@/components/shared/time-wheel-picker';
import { useAvailabilityCalendar, useAvailableDoctors } from '@/hooks/use-appointments';
import { useServiceList } from '@/hooks/use-services';
import { resolveAvatarUrl } from '@/lib/api/endpoints/uploads';
import { formatShiftHour, generateClinicTimeOptions } from '@/lib/utils/clinic-time-options';
import { cn } from '@/lib/utils/cn';
import type { AppointmentSlot, AvailableDoctorShift, ShiftType } from '@/types/appointments';
import type { PublicDoctorListItem } from '@/types/public-doctors';

const shiftLabels: Record<ShiftType, string> = {
  MORNING: 'Sáng',
  AFTERNOON: 'Chiều',
  FULL_DAY: 'Cả ngày',
};

function todayDateString() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const UNASSIGNED_TIME_OPTIONS = generateClinicTimeOptions();

// Small numbered-step indicator row above the doctor→service→date/time
// fields (non-unassigned path) — filled/current step is bg-primary, same
// circle style as the guest-booking page's section badges; not-yet-reached
// steps are muted.
function StepDot({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {n}
      </span>
      <span className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </div>
  );
}

export interface AppointmentBookingPayload {
  doctorId?: string;
  serviceId?: string;
  appointmentTime: string;
  note?: string;
}

export interface AppointmentBookingFieldsHandle {
  /** Runs validation, sets inline field errors, returns whether the form is valid. */
  validate: () => boolean;
  /** Only meaningful after a successful `validate()` call. */
  getPayload: () => AppointmentBookingPayload | null;
  /**
   * The first (highest-priority) inline field error after a failed
   * `validate()` call, or null if the form is valid — lets the caller's
   * toast say *what* is missing instead of a generic "check your info"
   * that leaves the user guessing which field is the actual problem.
   */
  getFirstError: () => string | null;
}

interface AppointmentBookingFieldsProps {
  note: string;
  onNoteChange: (note: string) => void;
  /**
   * "tabs" (patient self-booking, guest booking): two explicit, always-visible
   * entry points — clearer for patients than a checkbox that reshapes the form.
   * "checkbox" (receptionist walk-in, default): the original single-form
   * toggle — receptionist staff are trained on the flow, so the more compact
   * control is fine there.
   */
  variant?: 'checkbox' | 'tabs';
  /**
   * false (receptionist walk-in): the patient is physically at the desk, so
   * a doctor/service is always chosen on the spot — the "chưa biết chọn
   * dịch vụ/bác sĩ" doctor-less path doesn't apply here and is hidden
   * entirely (not just defaulted off). true (default, patient/guest
   * self-booking): the toggle/tabs are shown as usual.
   */
  allowUnassigned?: boolean;
  /**
   * false (default): renders exactly as before. true: wraps the fields in a
   * two-column layout on large screens with a sticky "Tóm tắt lịch hẹn"
   * summary card on the right, filled in from state already tracked by this
   * component — opt-in per caller so existing usages are unaffected.
   */
  showSummary?: boolean;
}

// Shared date/service/doctor/shift/slot booking UI — used by the patient
// self-booking page, the receptionist walk-in booking page, and the guest
// booking page. Includes the "chưa biết chọn dịch vụ/bác sĩ" toggle (when
// allowUnassigned): on, the service/doctor/shift/slot pickers are replaced
// by a plain date + time input and the appointment is booked without an
// assignment.
export const AppointmentBookingFields = forwardRef<AppointmentBookingFieldsHandle, AppointmentBookingFieldsProps>(
  function AppointmentBookingFields(
    { note, onNoteChange, variant = 'checkbox', allowUnassigned = true, showSummary = false },
    ref,
  ) {
    const [unassigned, setUnassignedState] = useState(false);
    // Ignore any attempt to turn the doctor-less path on when it's disabled
    // for this usage (defensive — the toggle UI is hidden too, so this
    // should be unreachable in practice).
    const setUnassigned = (value: boolean) => setUnassignedState(allowUnassigned && value);
    const [appointmentDate, setAppointmentDate] = useState('');
    const [unassignedTime, setUnassignedTime] = useState('');

    // Service-first flow: patients and guests first choose an examination
    // service, then only doctors in that service's specialty are listed.
    const [selectedDoctor, setSelectedDoctor] = useState<PublicDoctorListItem | null>(null);
    const doctorId = selectedDoctor?.userId ?? '';
    const [serviceId, setServiceId] = useState('');
    const [timeLabel, setTimeLabel] = useState('');
    const [selectedShift, setSelectedShift] = useState<AvailableDoctorShift | null>(null);
    const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
    const [appointmentTime, setAppointmentTime] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { data: services, isLoading: servicesLoading } = useServiceList({
      limit: 100,
      type: 'EXAMINATION',
    });
    const {
      data: availableDoctors,
      isLoading: doctorsLoading,
      isFetching: doctorsFetching,
    } = useAvailableDoctors(serviceId, appointmentDate);
    const { data: availabilityDays } = useAvailabilityCalendar(
      serviceId,
      appointmentDate.slice(0, 7) || todayDateString().slice(0, 7),
    );

    const examinationServices = useMemo(() => services?.items ?? [], [services]);
    const selectedService = examinationServices.find((service) => service.id === serviceId) ?? null;

    // Keep the selected doctor when the newly selected service still belongs
    // to that doctor's specialty; otherwise clear the incompatible doctor.
    useEffect(() => {
      setSelectedDoctor((current) => {
        if (!current || !selectedService) return current;
        return current.specialtyId === selectedService.specialtyId ? current : null;
      });
      setAppointmentDate('');
      setTimeLabel('');
      setSelectedShift(null);
      setSelectedSlot(null);
      setAppointmentTime('');
    }, [serviceId, selectedService]);

    const handleDoctorSelect = (doctor: PublicDoctorListItem) => {
      setSelectedDoctor(doctor);

      // When no service filter was chosen and this specialty has exactly one
      // examination service, select it automatically so it is immediately
      // reflected in the booking summary.
      if (!serviceId) {
        const doctorServices = examinationServices.filter(
          (service) => service.specialtyId === doctor.specialtyId,
        );
        if (doctorServices.length === 1) setServiceId(doctorServices[0].id);
      }
    };

    // A new doctor or date invalidates the previously chosen time slot.
    useEffect(() => {
      setAppointmentDate('');
      setTimeLabel('');
      setSelectedShift(null);
      setSelectedSlot(null);
      setAppointmentTime('');
    }, [doctorId]);

    useEffect(() => {
      setTimeLabel('');
      setSelectedShift(null);
      setSelectedSlot(null);
      setAppointmentTime('');
    }, [appointmentDate]);

    const doctorEntryForDate = useMemo(
      () => (availableDoctors ?? []).find((doctor) => doctor.doctorId === doctorId) ?? null,
      [availableDoctors, doctorId],
    );

    // Only this doctor's own free times, not the clinic-wide union — the
    // doctor is already fixed at this point in the flow.
    const doctorAvailableTimes = useMemo(() => {
      const set = new Set<string>();
      if (!doctorEntryForDate) return set;
      for (const shift of doctorEntryForDate.shifts) {
        for (const slot of shift.slots) {
          if (slot.available) set.add(slot.time);
        }
      }
      return set;
    }, [doctorEntryForDate]);

    // Show only the selected doctor's actually-bookable times —
    // not the full clinic time range with unavailable ones struck through
    // — and never show a time slot that has already passed today.
    const availableDoctorTimeOptions = useMemo(() => {
      const isToday = appointmentDate === todayDateString();
      const now = new Date();
      const nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      return UNASSIGNED_TIME_OPTIONS.filter(
        (time) => doctorAvailableTimes.has(time) && (!isToday || time > nowLabel),
      );
    }, [doctorAvailableTimes, appointmentDate]);

    const handleTimeChange = (time: string) => {
      setTimeLabel(time);
      const match = doctorEntryForDate?.shifts
        .map((shift) => ({ shift, slot: shift.slots.find((s) => s.time === time && s.available) }))
        .find((entry) => entry.slot);
      if (!match?.slot) {
        setSelectedShift(null);
        setSelectedSlot(null);
        setAppointmentTime('');
        return;
      }
      setSelectedShift(match.shift);
      setSelectedSlot(match.slot);
      setAppointmentTime(match.slot.datetime);
    };

    const disabledDates = useMemo(() => {
      const set = new Set<string>();
      for (const day of availabilityDays ?? []) {
        if (!day.hasAvailability) set.add(day.date);
      }
      return set;
    }, [availabilityDays]);

    // The doctor-less path has no per-slot capacity data to filter on (the
    // backend only checks the patient's own conflicts, not clinic-wide
    // capacity, when no doctor is assigned yet) — the one thing we *can*
    // derive client-side is "already past" when today is the chosen date,
    // so those times are excluded from the wheel entirely rather than
    // shown disabled.
    const availableUnassignedTimeOptions = useMemo(() => {
      if (appointmentDate === todayDateString()) {
        const now = new Date();
        const nowLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        return UNASSIGNED_TIME_OPTIONS.filter((time) => time > nowLabel);
      }
      return UNASSIGNED_TIME_OPTIONS;
    }, [appointmentDate]);

    // Always holds the latest state — avoids stale-closure issues in the
    // imperative handle exposed to the parent form's handleSubmit.
    const stateRef = useRef({
      unassigned,
      appointmentDate,
      unassignedTime,
      serviceId,
      doctorId,
      selectedShift,
      selectedSlot,
      appointmentTime,
      note,
    });
    stateRef.current = {
      unassigned,
      appointmentDate,
      unassignedTime,
      serviceId,
      doctorId,
      selectedShift,
      selectedSlot,
      appointmentTime,
      note,
    };

    useImperativeHandle(ref, () => ({
      validate: () => {
        const s = stateRef.current;
        const next: Record<string, string> = {};

        if (s.unassigned) {
          if (!s.appointmentDate) next.appointmentDate = 'Vui lòng chọn ngày khám';
          if (!s.unassignedTime) next.unassignedTime = 'Vui lòng chọn giờ mong muốn đến khám';
        } else {
          if (!s.serviceId) next.serviceId = 'Vui lòng chọn dịch vụ';
          if (s.serviceId && !s.doctorId) next.doctorId = 'Vui lòng chọn bác sĩ';
          if (s.doctorId && !s.appointmentDate) next.appointmentDate = 'Vui lòng chọn ngày khám';
          if (s.appointmentDate && !s.selectedSlot) next.appointmentTime = 'Vui lòng chọn giờ khám';
        }

        setErrors(next);
        return Object.keys(next).length === 0;
      },
      getPayload: () => {
        const s = stateRef.current;

        if (s.unassigned) {
          if (!s.appointmentDate || !s.unassignedTime) return null;
          const [year, month, day] = s.appointmentDate.split('-').map(Number);
          const [hour, minute] = s.unassignedTime.split(':').map(Number);
          return {
            doctorId: undefined,
            serviceId: undefined,
            appointmentTime: new Date(Date.UTC(year, month - 1, day, hour, minute)).toISOString(),
            note: s.note.trim() || undefined,
          };
        }

        if (!s.doctorId || !s.serviceId || !s.appointmentDate || !s.appointmentTime) return null;
        return {
          doctorId: s.doctorId,
          serviceId: s.serviceId,
          appointmentTime: s.appointmentTime,
          note: s.note.trim() || undefined,
        };
      },
      getFirstError: () => Object.values(errors)[0] ?? null,
    }));

    // Only used by the summary card below (showSummary) — the full Service
    // object isn't needed anywhere else, just its display name.
    // Choosing a service in the filter alone must not make it look confirmed
    // in the summary. It becomes part of the booking only after a compatible
    // doctor has also been selected.
    const selectedServiceName = selectedDoctor ? selectedService?.name ?? null : null;
    const doctorAvatarUrl = resolveAvatarUrl(selectedDoctor?.avatarUrl);

    const fieldsContent = (
      <div className="grid gap-4 md:grid-cols-2">
        {!allowUnassigned ? null : variant === 'tabs' ? (
          <div className="space-y-2 md:col-span-2">
            <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!unassigned}
                onClick={() => {
                  setUnassigned(false);
                  setErrors({});
                }}
                className={cn(
                  'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  !unassigned ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Đặt theo bác sĩ cụ thể
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={unassigned}
                onClick={() => {
                  setUnassigned(true);
                  setErrors({});
                }}
                className={cn(
                  'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  unassigned ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Đặt lịch nhanh
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {unassigned
                ? 'Bạn sẽ được tư vấn trực tiếp tại phòng khám — dịch vụ và bác sĩ phù hợp sẽ được chỉ định sau.'
                : 'Chọn dịch vụ và bác sĩ mong muốn, cùng khung giờ còn trống.'}
            </p>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={unassigned}
              onChange={(event) => {
                setUnassigned(event.target.checked);
                setErrors({});
              }}
            />
            Tôi chưa biết chọn dịch vụ/bác sĩ phù hợp — tư vấn tại phòng khám trước
          </label>
        )}

        {unassigned ? (
          <>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Ngày khám <span className="text-destructive">*</span>
              </span>
              <AppointmentDatePicker min={todayDateString()} value={appointmentDate} onChange={setAppointmentDate} />
              {errors.appointmentDate && <p className="text-xs text-destructive">{errors.appointmentDate}</p>}
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                Giờ mong muốn đến khám <span className="text-destructive">*</span>
              </span>
              <TimeWheelPicker value={unassignedTime} onChange={setUnassignedTime} options={availableUnassignedTimeOptions} />
              {errors.unassignedTime && <p className="text-xs text-destructive">{errors.unassignedTime}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:col-span-2">
              <StepDot n={1} label="Chọn bác sĩ" active={Boolean(doctorId)} />
              <span className="text-muted-foreground">→</span>
              <StepDot n={2} label="Ngày giờ" active={Boolean(appointmentTime)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Danh sách bác sĩ <span className="text-destructive">*</span>
              </span>
              <DoctorSearchList
                key={serviceId || 'all-doctors'}
                value={doctorId}
                onSelect={handleDoctorSelect}
                specialtyId={selectedService?.specialtyId ?? undefined}
                showSpecialtyFilter={false}
                filterControl={
                  <Select
                    aria-label="Lọc bác sĩ theo dịch vụ khám"
                    value={serviceId}
                    onChange={(event) => setServiceId(event.target.value)}
                    disabled={servicesLoading}
                    className="sm:w-72"
                  >
                    <option value="">
                      {servicesLoading ? 'Đang tải dịch vụ...' : 'Lọc theo dịch vụ khám'}
                    </option>
                    {examinationServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </Select>
                }
              />
              <p className="text-xs text-muted-foreground">
                Bộ lọc chỉ bao gồm dịch vụ khám, không bao gồm dịch vụ CLS.
              </p>
              {serviceId && !selectedService?.specialtyId && (
                <p className="text-xs text-amber-600">
                  Dịch vụ này chưa được gán chuyên khoa nên không thể lọc chính xác bác sĩ.
                </p>
              )}
              {errors.serviceId && <p className="text-xs text-destructive">{errors.serviceId}</p>}
              {errors.doctorId && <p className="text-xs text-destructive">{errors.doctorId}</p>}
            </div>

            {serviceId && doctorId && (
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">
                  Ngày khám <span className="text-destructive">*</span>
                </span>
                <AppointmentDatePicker
                  min={todayDateString()}
                  value={appointmentDate}
                  onChange={setAppointmentDate}
                  disabledDates={disabledDates}
                />
                {errors.appointmentDate && <p className="text-xs text-destructive">{errors.appointmentDate}</p>}
                {appointmentDate && disabledDates.has(appointmentDate) && (
                  <p className="text-xs text-amber-600">⚠ Ngày này đã hết chỗ, vui lòng chọn ngày khác.</p>
                )}
              </div>
            )}

            {serviceId && doctorId && appointmentDate && (
              <div className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-foreground">
                  Giờ khám <span className="text-destructive">*</span>
                </span>
                {doctorsLoading || doctorsFetching ? (
                  <p className="text-xs text-muted-foreground">Đang tải khung giờ...</p>
                ) : !doctorEntryForDate ? (
                  <p className="text-xs text-amber-600">
                    ⚠ Bác sĩ không có lịch trống ngày này, vui lòng chọn ngày khác.
                  </p>
                ) : (
                  <TimeSlotGrid value={timeLabel} onChange={handleTimeChange} options={availableDoctorTimeOptions} />
                )}
                {errors.appointmentTime && <p className="text-xs text-destructive">{errors.appointmentTime}</p>}
              </div>
            )}

            {selectedShift && (
              <p className="text-xs text-muted-foreground md:col-span-2">
                Phòng khám: {selectedShift.roomName ?? 'Chưa xác định'} · Ca {shiftLabels[selectedShift.shift]} (
                {formatShiftHour(selectedShift.startHour)}–{formatShiftHour(selectedShift.endHour)})
              </p>
            )}
          </>
        )}

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-foreground">Ghi chú</span>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            placeholder="Ghi chú thêm (tuỳ chọn)"
          />
        </label>
      </div>
    );

    if (!showSummary) return fieldsContent;

    // "Tóm tắt lịch hẹn" summary card (version-up UI redesign) — purely
    // derived from state already tracked above; each row falls back to
    // "Chưa chọn" until that piece of state is set. When `unassigned` is
    // active it reflects that path's date/time instead of doctor/service,
    // which can never be picked on that path.
    const summaryCard = (
      <Card className="space-y-4 p-4">
        <p className="text-sm font-semibold text-foreground">Tóm tắt lịch hẹn</p>

        {unassigned ? (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Ngày khám</p>
              <p className="font-medium text-foreground">
                {appointmentDate ? (
                  formatDisplayDate(appointmentDate)
                ) : (
                  <span className="text-muted-foreground">Chưa chọn</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Giờ mong muốn đến khám</p>
              <p className="font-medium text-foreground">
                {unassignedTime || <span className="text-muted-foreground">Chưa chọn</span>}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Bác sĩ</p>
              {selectedDoctor ? (
                <div className="mt-1 flex items-center gap-2">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted bg-cover bg-center"
                    style={doctorAvatarUrl ? { backgroundImage: `url(${doctorAvatarUrl})` } : undefined}
                  >
                    {!doctorAvatarUrl && <UserIcon className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{selectedDoctor.fullName}</p>
                    {selectedDoctor.specialtyName && (
                      <Badge variant="default" className="mt-0.5">
                        {selectedDoctor.specialtyName}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="font-medium text-muted-foreground">Chưa chọn</p>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Dịch vụ</p>
              <p className="font-medium text-foreground">
                {selectedServiceName || <span className="text-muted-foreground">Chưa chọn</span>}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Ngày khám</p>
              <p className="font-medium text-foreground">
                {appointmentDate ? (
                  formatDisplayDate(appointmentDate)
                ) : (
                  <span className="text-muted-foreground">Chưa chọn</span>
                )}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Giờ khám</p>
              <p className="font-medium text-foreground">
                {timeLabel || <span className="text-muted-foreground">Chưa chọn</span>}
              </p>
              {selectedShift && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Phòng khám: {selectedShift.roomName ?? 'Chưa xác định'} · Ca {shiftLabels[selectedShift.shift]} (
                  {formatShiftHour(selectedShift.startHour)}–{formatShiftHour(selectedShift.endHour)})
                </p>
              )}
            </div>
          </div>
        )}
      </Card>
    );

    return (
      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:gap-6">
        {fieldsContent}
        <div className="lg:sticky lg:top-20">{summaryCard}</div>
      </div>
    );
  },
);
