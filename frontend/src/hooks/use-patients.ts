'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { patientsApi } from '@/lib/api/endpoints/patients';
import { useNotificationStore } from '@/stores/notification.store';
import { useAuthStore } from '@/stores/auth.store';
import type { CreatePatientRequest, PatientQuery, UpdatePatientRequest } from '@/types/patients';

export function usePatients(query: PatientQuery = {}, enabled = true) {
  return useQuery({
    queryKey: ['patients', query],
    queryFn: () => patientsApi.findMany(query),
    enabled,
  });
}

export function usePatient(id?: string | null) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientsApi.findOne(id ?? ''),
    enabled: Boolean(id),
  });
}

// `redirect: false` skips the receptionist auto-navigate-to-detail-page
// behavior below — for flows that create a patient inline as a step inside
// something else (e.g. picking/creating a patient while booking an
// appointment) and want to stay put, not jump away from what they were doing.
// UC 2.3.1 — hook thực hiện việc gọi API tạo hồ sơ bệnh nhân. Được gọi từ
// receptionist/patients/new/page.tsx (createPatient.mutate(payload)).
export function useCreatePatient(options?: { redirect?: boolean }) {
  const redirect = options?.redirect ?? true;
  const queryClient = useQueryClient();
  const pushToast = useNotificationStore((state) => state.push);
  const router = useRouter();
  const role = useAuthStore((state) => state.user?.role);

  return useMutation({
    // Đây là dòng THỰC SỰ gọi API — chuyển tiếp xuống patientsApi.create().
    mutationFn: (input: CreatePatientRequest) => patientsApi.create(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      pushToast({ variant: 'success', title: result.message });
      if (result.data) {
        queryClient.setQueryData(['patients', result.data.id], result.data);
        // Redirect only applies to the receptionist's dedicated detail page —
        // other roles (e.g. admin) keep using their own in-page dialog flow.
        if (redirect && role === 'RECEPTIONIST') {
          router.push(`/receptionist/patients/${result.data.id}`);
        }
      }
    },
    onError: (error) => {
      pushToast({ variant: 'error', title: error.message });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  const pushToast = useNotificationStore((state) => state.push);

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePatientRequest }) => patientsApi.update(id, input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['patients'] });
      if (result.data) {
        queryClient.setQueryData(['patients', result.data.id], result.data);
        pushToast({ variant: 'success', title: result.message, description: result.data.patientCode });
      }
    },
    onError: (error) => {
      pushToast({ variant: 'error', title: error.message });
    },
  });
}
