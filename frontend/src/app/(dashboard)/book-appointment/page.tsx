'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  AppointmentBookingFields,
  type AppointmentBookingFieldsHandle,
} from '@/components/shared/appointment-booking-fields';
import { PatientPageHeader } from '@/components/shared/patient-page-header';
import { useCreateAppointment } from '@/hooks/use-appointments';
import { useNotificationStore } from '@/stores/notification.store';

export default function PatientBookAppointmentPage() {
  const router = useRouter();
  const pushToast = useNotificationStore((state) => state.push);
  const createAppointment = useCreateAppointment();

  const fieldsRef = useRef<AppointmentBookingFieldsHandle>(null);
  const [note, setNote] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fieldsRef.current?.validate()) {
      pushToast({
        variant: 'warning',
        title: 'Vui lòng kiểm tra lại thông tin',
        description: fieldsRef.current?.getFirstError() ?? undefined,
      });
      return;
    }

    const payload = fieldsRef.current.getPayload();
    if (!payload) {
      pushToast({ variant: 'warning', title: 'Vui lòng kiểm tra lại thông tin' });
      return;
    }

    createAppointment.mutate(payload, {
      onSuccess: () => {
        router.push('/my-appointments');
      },
    });
  };

  return (
    <div className="min-h-full bg-background">
      <PatientPageHeader
        icon={CalendarPlus}
        title="Đặt lịch khám"
        description="Đặt lịch hẹn khám bệnh cho chính bạn"
      />

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <Card className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <AppointmentBookingFields
              ref={fieldsRef}
              note={note}
              onNoteChange={setNote}
              variant="tabs"
              showSummary
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createAppointment.isPending}>
                {createAppointment.isPending ? 'Đang lưu...' : 'Đặt lịch khám'}
              </Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
