'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { medicalRecordsApi } from '@/lib/api/endpoints/medical-records';
import { useNotificationStore } from '@/stores/notification.store';
import type { MedicalRecordQuery, UpdateMedicalRecordRequest } from '@/types/medical-records';

export function useMedicalRecords(query: MedicalRecordQuery = {}, enabled = true) {
  return useQuery({
    queryKey: ['medical-records', query],
    queryFn: () => medicalRecordsApi.findMany(query),
    enabled,
  });
}

// UC 2.3.2 — "Xem bệnh án của 1 bệnh nhân cụ thể". `enabled: Boolean(patientId)`
// nghĩa là: hook này CHỈ thật sự gọi API khi đã có patientId (chưa chọn
// bệnh nhân thì chưa gọi gì cả, tránh gọi API với id rỗng).
export function useMedicalRecord(patientId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['medical-records', patientId],
    queryFn: () => medicalRecordsApi.findOne(patientId ?? ''),
    enabled: enabled && Boolean(patientId),
  });
}

export function useMyMedicalRecord(enabled = true) {
  return useQuery({
    queryKey: ['medical-records', 'me'],
    queryFn: () => medicalRecordsApi.findMine(),
    enabled,
  });
}

export function useMedicalRecordPrint(patientId: string | undefined, visitIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ['medical-records', patientId, 'print', visitIds],
    queryFn: () => medicalRecordsApi.print(patientId ?? '', visitIds),
    enabled: enabled && Boolean(patientId),
  });
}

/**
 * Determines whether a patient has an existing visit history, to drive the
 * "Hồ sơ bệnh án" vs "Khám lần đầu" buttons. A lookup error (e.g. 404 — no
 * record yet) is treated as "no history" instead of an error — this is an
 * expected state, not a failure, so no toast should be shown for it.
 */
export function useHasMedicalHistory(patientId?: string | null) {
  const query = useQuery({
    queryKey: ['medical-records', patientId],
    queryFn: () => medicalRecordsApi.findOne(patientId ?? ''),
    enabled: Boolean(patientId),
    retry: false,
  });

  return {
    hasHistory: Boolean(query.data && query.data.visits.length > 0),
    isLoading: query.isLoading,
  };
}

// UC 2.3.3 — "Bác sĩ lưu cập nhật bệnh án". Được gọi từ
// medical-records-workspace.tsx (updateMedicalRecord.mutateAsync(...)).
export function useUpdateMedicalRecord() {
  const queryClient = useQueryClient();
  const pushToast = useNotificationStore((state) => state.push);

  return useMutation({
    // Nơi thật sự gọi API — chuyển tiếp xuống medicalRecordsApi.update().
    mutationFn: ({ patientId, input }: { patientId: string; input: UpdateMedicalRecordRequest }) =>
      medicalRecordsApi.update(patientId, input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['medical-records'] });
      if (result.data) {
        queryClient.setQueryData(['medical-records', result.data.patient.id], result.data);
        pushToast({ variant: 'success', title: result.message, description: result.data.patient.patientCode });
      }
    },
    onError: (error) => {
      pushToast({ variant: 'error', title: error.message });
    },
  });
}
