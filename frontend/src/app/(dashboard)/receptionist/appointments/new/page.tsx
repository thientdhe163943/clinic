'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  AppointmentBookingFields,
  type AppointmentBookingFieldsHandle,
} from '@/components/shared/appointment-booking-fields';
import { PageHeader } from '@/components/shared/page-header';
import { PatientForm } from '@/components/shared/patient-form';
import { useCreateAppointment } from '@/hooks/use-appointments';
import { useCreatePatient } from '@/hooks/use-patients';
import { patientsApi } from '@/lib/api/endpoints/patients';
import { useNotificationStore } from '@/stores/notification.store';
import type { CreatePatientRequest, PatientProfile } from '@/types/patients';

function usePatientSearch(search: string) {
  return useQuery({
    queryKey: ['patients', 'search', search],
    queryFn: () => patientsApi.findMany({ search, limit: 10 }),
    enabled: search.trim().length > 0,
  });
}

export default function ReceptionistNewAppointmentPage() {
  const router = useRouter();
  const pushToast = useNotificationStore((state) => state.push);
  const createAppointment = useCreateAppointment();
  // redirect: false — creating a patient here is a step inside booking, not
  // its own destination; the receptionist should land back on this form with
  // the new patient already picked, not get bounced to the patient's detail page.
  const createPatient = useCreatePatient({ redirect: false });

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientProfile | null>(null);
  const [note, setNote] = useState('');
  const [patientError, setPatientError] = useState('');
  const [createPatientOpen, setCreatePatientOpen] = useState(false);
  const fieldsRef = useRef<AppointmentBookingFieldsHandle>(null);

  const { data: patientResults, isFetching: patientSearching } = usePatientSearch(patientSearch);

  useEffect(() => {
    if (selectedPatient && patientSearch !== selectedPatient.fullName) {
      setSelectedPatient(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientSearch]);

  const patientMatches = useMemo(() => patientResults?.items ?? [], [patientResults]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldsValid = fieldsRef.current?.validate() ?? false;
    if (!selectedPatient) setPatientError('Vui lòng chọn bệnh nhân');
    else setPatientError('');

    if (!fieldsValid || !selectedPatient) {
      // Patient selection takes priority in the message — it's a separate
      // step outside AppointmentBookingFields, so its own error would
      // otherwise be masked by whatever field error happens to be first.
      const description = !selectedPatient ? 'Vui lòng chọn bệnh nhân' : fieldsRef.current?.getFirstError() ?? undefined;
      pushToast({ variant: 'warning', title: 'Vui lòng kiểm tra lại thông tin', description });
      return;
    }

    const payload = fieldsRef.current?.getPayload();
    if (!payload) {
      pushToast({ variant: 'warning', title: 'Vui lòng kiểm tra lại thông tin' });
      return;
    }

    createAppointment.mutate(
      { ...payload, patientId: selectedPatient.id },
      {
        onSuccess: () => {
          router.push('/receptionist/appointments');
        },
      },
    );
  };

  async function handleCreatePatient(payload: CreatePatientRequest) {
    const result = await createPatient.mutateAsync(payload);
    if (result.data) {
      setSelectedPatient(result.data);
      setPatientSearch(result.data.fullName);
      setPatientError('');
      setCreatePatientOpen(false);
    }
  }

  return (
    <div className="min-h-full bg-background">
      <PageHeader
        title="Tạo lịch hẹn"
        description="Đặt lịch hẹn mới cho bệnh nhân"
        action={
          <Link href="/receptionist/appointments">
            <Button variant="secondary">Trở về danh sách</Button>
          </Link>
        }
      />

      <section className="space-y-4 p-5">
        <Card className="p-6">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <label className="relative block space-y-2">
              <span className="text-sm font-medium text-foreground">
                Bệnh nhân <span className="text-destructive">*</span>
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={patientSearch}
                  onChange={(event) => setPatientSearch(event.target.value)}
                  placeholder="Tìm theo tên, mã BN hoặc số điện thoại"
                />
              </div>
              {selectedPatient ? (
                <p className="text-xs text-muted-foreground">
                  Đã chọn: <span className="font-medium text-foreground">{selectedPatient.fullName}</span> (
                  {selectedPatient.patientCode}) — {selectedPatient.phone}
                </p>
              ) : patientSearch.trim() ? (
                <Card className="max-h-56 overflow-y-auto p-1">
                  {patientSearching ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Đang tìm kiếm...</p>
                  ) : patientMatches.length === 0 ? (
                    <div className="px-3 py-2">
                      <p className="text-sm text-muted-foreground">Không tìm thấy bệnh nhân phù hợp.</p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="mt-2"
                        onClick={() => setCreatePatientOpen(true)}
                      >
                        Tạo bệnh nhân mới
                      </Button>
                    </div>
                  ) : (
                    patientMatches.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedPatient(patient);
                          setPatientSearch(patient.fullName);
                        }}
                      >
                        <span className="font-medium text-foreground">{patient.fullName}</span>
                        <span className="text-xs text-muted-foreground">
                          {patient.patientCode} — {patient.phone}
                        </span>
                      </button>
                    ))
                  )}
                </Card>
              ) : null}
              {patientError && <p className="text-xs text-destructive">{patientError}</p>}
            </label>

            <AppointmentBookingFields
              ref={fieldsRef}
              note={note}
              onNoteChange={setNote}
              allowUnassigned={false}
            />

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={createAppointment.isPending}>
                {createAppointment.isPending ? 'Đang lưu...' : 'Tạo lịch hẹn'}
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <Modal open={createPatientOpen} onClose={() => setCreatePatientOpen(false)} title="Tạo bệnh nhân mới">
        <PatientForm
          initial={{
            fullName: patientSearch.trim(),
            email: '',
            dateOfBirth: '',
            gender: 'MALE',
            phone: '',
            idCard: '',
            address: '',
            note: '',
            // Default on, matching the dedicated "Tạo bệnh nhân mới" page
            // (receptionist/patients/new) — this was previously defaulted
            // off here only, so a patient created inline while booking an
            // appointment would silently never receive any notification
            // (confirm/cancel/results/invoice) unless the receptionist
            // happened to notice and check this box themselves.
            notificationConsent: true,
          }}
          onSubmit={handleCreatePatient}
          onCancel={() => setCreatePatientOpen(false)}
          loading={createPatient.isPending}
          submitLabel="Tạo hồ sơ"
          mode="create"
        />
      </Modal>
    </div>
  );
}
