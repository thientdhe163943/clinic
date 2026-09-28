'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { roomsApi } from '@/lib/api/endpoints/rooms';
import type { CreateRoomRequest, Room, UpdateRoomRequest } from '@/types/rooms';

export function useRooms() {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsApi.list(),
  });
}

export function useRoom(id: string | undefined) {
  return useQuery({
    queryKey: ['rooms', id],
    queryFn: () => roomsApi.getById(id ?? ''),
    enabled: Boolean(id),
  });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: CreateRoomRequest) => roomsApi.create(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (result.data) queryClient.setQueryData(['rooms', result.data.id], result.data);
      router.push('/admin/rooms');
    },
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoomRequest }) => roomsApi.update(id, input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (result.data) queryClient.setQueryData(['rooms', result.data.id], result.data);
    },
  });
}

export function useActivateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => roomsApi.activate(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (result.data) queryClient.setQueryData(['rooms', result.data.id], result.data);
    },
  });
}

export function useDeactivateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => roomsApi.deactivate(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (result.data) queryClient.setQueryData(['rooms', result.data.id], result.data);
    },
  });
}
