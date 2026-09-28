'use client';

import { useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DoctorPicker } from '@/components/shared/doctor-picker';
import { TimeSlotGrid } from '@/components/shared/time-slot-grid';
import { useAvailableDoctors, useUpdateAppointment } from '@/hooks/use-appointments';
import { useServiceList } from '@/hooks/use-services';
import { formatAppointmentDateTime, parseDateTimeLocalAsAppointmentTime } from '@/lib/utils/appointment-datetime';
import { formatShiftHour, generateClinicTimeOptions } from '@/lib/utils/clinic-time-options';
import { todayDateString } from '@/lib/utils/date';
import { useNotificationStore } from '@/stores/notification.store';
import type { Appointment } from '@/types/appointments';

const RESCHEDULE_TIME_OPTIONS = generateClinicTimeOptions();

// appointmentTime is a naive VN wall-clock value labeled UTC — read its
// UTC-labeled components directly (not real local getters, which would
// convert to the browser's timezone and show the wrong hour).
function toDateOnlyInput(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toTimeOnlyInput(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

// Reused by both the appointment detail page/drawer and the check-in page —
// lets a receptionist change Dịch vụ/Bác sĩ/Giờ hẹn/Ghi chú for a
// PENDING/CONFIRMED appointment without leaving whichever screen they're on
// (previously this only lived on the detail page, forcing a redirect from
// check-in just to fix a missing/wrong doctor or service).
export function AppointmentScheduleEditor({ appointment }: { appointment: Appointment }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDoctorId, setEditDoctorId] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNote, setEditNote] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  // type: 'EXAMINATION' — an appointment's service must be a bookable exam
  // service, never a CLS-type one; those have no specialtyId and are only
  // ever ordered by a doctor during a visit.
  const { data: services } = useServiceList({ limit: 100, type: 'EXAMINATION' });
  // Separate, search-filtered query backing the edit-form's service <select>
  // options only — `services` above (unfiltered) stays the source of truth
  // for resolving the currently-selected service (e.g. its specialtyId for
  // the doctor picker below), so typing in the search box can never make the
  // already-picked service "disappear" out from under that lookup.
  const { data: filteredServices } = useServiceList({
    limit: 100,
    type: 'EXAMINATION',
    search: serviceSearch || undefined,
  });
  const updateAppointment = useUpdateAppointment();
  const pushToast = useNotificationStore((state) => state.push);

  // Re-sync the form (and close it) whenever a different appointment is
  // shown, and on first mount for this one — same pattern regardless of
  // whether this instance lives on the check-in page or the detail drawer.
  useEffect(() => {
    setEditDoctorId(appointment.doctorId ?? '');
    setEditServiceId(appointment.serviceId ?? '');
    setEditDate(toDateOnlyInput(appointment.appointmentTime));
    setEditTime(toTimeOnlyInput(appointment.appointmentTime));
    setEditNote(appointment.note ?? '');
    setIsEditing(false);
    setServiceSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointment.id]);

  const {
    data: availableDoctors,
    isLoading: doctorsLoading,
    isFetching: doctorsFetching,
  } = useAvailableDoctors(editServiceId, editDate);
  const doctorsReady = Boolean(editServiceId) && Boolean(editDate);
  const doctorOptions = availableDoctors ?? [];
  const editSelectedService = (services?.items ?? []).find((service) => service.id === editServiceId) ?? null;

  // Feature 59 business rule: room shown here is informational only (the
  // room is actually locked in at check-in, per work_schedules of whichever
  // shift is active then) — but the receptionist must still be able to see,
  // at reassignment time, which room the doctor+time combination maps to
  // today, so a doctor isn't picked without realizing it puts the patient in
  // a different room than expected.
  const editSelectedDoctorOption = doctorOptions.find((doctor) => doctor.doctorId === editDoctorId) ?? null;
  const editSelectedShift =
    editSelectedDoctorOption && editTime
      ? (editSelectedDoctorOption.shifts.find((shift) => {
          const [hourStr] = editTime.split(':');
          const hour = Number(hourStr);
          return hour >= shift.startHour && hour < shift.endHour;
        }) ?? null)
      : null;

  // Same "only ever show times that are actually bookable" rule the guest/
  // patient self-booking flow uses (see availableDoctorTimeOptions in
  // appointment-booking-fields.tsx) — a struck-through-but-clickable-looking
  // wheel option invited mis-taps, so slots the selected doctor is already
  // booked for are left out of the list entirely instead of merely disabled.
  // The appointment's own current slot is the one exception: the backend
  // reports it as unavailable too (it's booked — by this very appointment),
  // so it's added back in, or re-saving without actually changing
  // date/time/doctor would show no valid slot to reselect.
  const editDoctorAvailableTimes = useMemo(() => {
    const set = new Set<string>();
    if (!editSelectedDoctorOption) return set;

    const isOwnDoctorAndDate =
      editDoctorId === (appointment.doctorId ?? '') && editDate === toDateOnlyInput(appointment.appointmentTime);
    const ownTime = isOwnDoctorAndDate ? toTimeOnlyInput(appointment.appointmentTime) : null;

    for (const shift of editSelectedDoctorOption.shifts) {
      for (const slot of shift.slots) {
        if (slot.available || slot.time === ownTime) set.add(slot.time);
      }
    }
    return set;
  }, [editSelectedDoctorOption, editDoctorId, editDate, appointment]);

  // A time already past (today only) is never bookable regardless of doctor
  // — same day-boundary rule as guest booking, applied to whichever list
  // (doctor-filtered or wide-open) ends up being shown below.
  const isEditDateToday = editDate === todayDateString();
  const nowLabel = (() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  })();

  // Doctor chosen: only that doctor's genuinely free slots. No doctor chosen
  // (the "chưa chỉ định" path this form also allows): the full clinic time
  // range, same as guest booking's own doctor-less flow — there's no
  // per-doctor capacity to filter against yet.
  const editTimeOptions = useMemo(() => {
    const base = editDoctorId
      ? RESCHEDULE_TIME_OPTIONS.filter((time) => editDoctorAvailableTimes.has(time))
      : RESCHEDULE_TIME_OPTIONS;
    return isEditDateToday ? base.filter((time) => time > nowLabel) : base;
  }, [editDoctorId, editDoctorAvailableTimes, isEditDateToday, nowLabel]);

  const canEdit = appointment.status === 'PENDING' || appointment.status === 'CONFIRMED';
  const missingDoctorForService = Boolean(editServiceId) && !editDoctorId;

  const handleUpdate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (missingDoctorForService) {
      pushToast({ variant: 'warning', title: 'Vui lòng chỉ định Bác sĩ' });
      return;
    }

    updateAppointment.mutate(
      {
        id: appointment.id,
        // doctorId/serviceId/note are always sent explicitly (string or
        // null) rather than omitted — this form represents the full current
        // state of the schedule, so "cleared back to Chưa chỉ định" must
        // reach the backend as an explicit null, not a field the backend
        // then treats as "unchanged" and silently keeps the old value for.
        data: {
          doctorId: editDoctorId || null,
          serviceId: editServiceId || null,
          appointmentTime:
            editDate && editTime ? parseDateTimeLocalAsAppointmentTime(`${editDate}T${editTime}`) : undefined,
          note: editNote.trim() || null,
        },
      },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleCancelEdit = () => {
    setEditDoctorId(appointment.doctorId ?? '');
    setEditServiceId(appointment.serviceId ?? '');
    setEditDate(toDateOnlyInput(appointment.appointmentTime));
    setEditTime(toTimeOnlyInput(appointment.appointmentTime));
    setEditNote(appointment.note ?? '');
    setIsEditing(false);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Thông tin lịch hẹn</p>
        {canEdit && !isEditing && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Chỉnh sửa
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Dịch vụ</p>
            <p className="font-medium">{appointment.serviceName || 'Chưa chỉ định'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bác sĩ</p>
            <p className="font-medium">{appointment.doctorName || 'Chưa chỉ định'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Giờ hẹn</p>
            <p className="font-medium">{formatAppointmentDateTime(appointment.appointmentTime)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Phòng khám</p>
            <p className="font-medium">
              {appointment.roomName ?? <span className="text-muted-foreground">Chưa xác định — chốt lúc check-in</span>}
            </p>
          </div>
          {appointment.note && (
            <div className="col-span-2">
              <p className="text-muted-foreground">Ghi chú</p>
              <p className="font-medium">{appointment.note}</p>
            </div>
          )}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleUpdate}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Dịch vụ</span>
              <Input
                value={serviceSearch}
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Tìm theo tên hoặc mã dịch vụ..."
              />
              <select
                value={editServiceId}
                onChange={(event) => {
                  setEditServiceId(event.target.value);
                  setEditDoctorId('');
                }}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              >
                <option value="">Chưa chỉ định</option>
                {(filteredServices?.items ?? []).map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Ngày hẹn</span>
              <Input
                type="date"
                min={todayDateString()}
                value={editDate}
                onChange={(event) => {
                  setEditDate(event.target.value);
                  setEditDoctorId('');
                }}
              />
            </label>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Bác sĩ</span>
              {!doctorsReady ? (
                <p className="text-xs text-muted-foreground">
                  Vui lòng chọn dịch vụ và ngày hẹn để xem bác sĩ còn lịch trống.
                </p>
              ) : doctorsLoading || doctorsFetching ? (
                <p className="text-xs text-muted-foreground">Đang tải danh sách bác sĩ...</p>
              ) : (
                <DoctorPicker
                  doctorOptions={doctorOptions}
                  specialtyId={editSelectedService?.specialtyId ?? null}
                  value={editDoctorId}
                  onChange={setEditDoctorId}
                />
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Giờ hẹn</span>
              <TimeSlotGrid value={editTime} onChange={setEditTime} options={editTimeOptions} />
            </div>
            {editDoctorId && editTime && (
              <p className="text-xs text-muted-foreground md:col-span-2">
                Phòng khám: {editSelectedShift?.roomName ?? 'Chưa xác định'}
                {editSelectedShift
                  ? ` · Ca ${formatShiftHour(editSelectedShift.startHour)}–${formatShiftHour(editSelectedShift.endHour)}`
                  : ''}
              </p>
            )}
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-foreground">Ghi chú</span>
              <textarea
                rows={3}
                value={editNote}
                onChange={(event) => setEditNote(event.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={updateAppointment.isPending}>
              {updateAppointment.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleCancelEdit}>
              Hủy
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
