'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsRoomsApi } from '@/lib/api/endpoints/rooms';
import type { ClsRoomCategory, SaveClsRoomRequest } from '@/types/rooms';

const key = ['cls-rooms'] as const;

export function useClsRooms(status?: 'ACTIVE' | 'INACTIVE', category?: ClsRoomCategory) {
  return useQuery({ queryKey: [...key, status, category], queryFn: () => clsRoomsApi.list(status, category) });
}

export function useClsRoomMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: key });
  return {
    create: useMutation({ mutationFn: (input: SaveClsRoomRequest) => clsRoomsApi.create(input), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: SaveClsRoomRequest }) => clsRoomsApi.update(id, input), onSuccess: refresh }),
    activate: useMutation({ mutationFn: clsRoomsApi.activate, onSuccess: refresh }),
    deactivate: useMutation({ mutationFn: ({ id, confirm }: { id: string; confirm?: boolean }) => clsRoomsApi.deactivate(id, confirm), onSuccess: refresh }),
  };
}
