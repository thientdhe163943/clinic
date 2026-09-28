'use client';

import { useQuery } from '@tanstack/react-query';
import { clinicInfoApi } from '@/lib/api/endpoints/clinic-info';

export function useClinicInfo() {
  return useQuery({
    queryKey: ['clinic-info'],
    queryFn: () => clinicInfoApi.get(),
    staleTime: 5 * 60 * 1000,
  });
}
