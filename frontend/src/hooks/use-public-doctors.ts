'use client';

import { useQuery } from '@tanstack/react-query';
import { publicDoctorsApi } from '@/lib/api/endpoints/public-doctors';
import type { ListPublicDoctorsQuery } from '@/types/public-doctors';

export function usePublicDoctors(params?: ListPublicDoctorsQuery, enabled = true) {
  return useQuery({
    queryKey: ['public-doctors', params],
    queryFn: () => publicDoctorsApi.list(params),
    enabled,
  });
}

export function usePublicDoctor(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['public-doctors', id],
    queryFn: () => publicDoctorsApi.getById(id ?? ''),
    enabled: enabled && Boolean(id),
  });
}
