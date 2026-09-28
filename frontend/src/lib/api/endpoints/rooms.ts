import { apiClient, unwrap, unwrapResult } from '../client';
import type { ClsRoomCategory, CreateRoomRequest, DeactivateClsRoomResponse, Room, SaveClsRoomRequest, UpdateRoomRequest } from '@/types/rooms';

export const roomsApi = {
  list() {
    return unwrap<Room[]>(apiClient.get('/rooms'));
  },

  getById(id: string) {
    return unwrap<Room>(apiClient.get(`/rooms/${id}`));
  },

  create(input: CreateRoomRequest) {
    return unwrapResult<Room>(apiClient.post('/rooms', input));
  },

  update(id: string, input: UpdateRoomRequest) {
    return unwrapResult<Room>(apiClient.put(`/rooms/${id}`, input));
  },

  activate(id: string) {
    return unwrapResult<Room>(apiClient.patch(`/rooms/${id}/activate`));
  },

  deactivate(id: string) {
    return unwrapResult<Room>(apiClient.patch(`/rooms/${id}/deactivate`));
  },
};

export const clsRoomsApi = {
  list(status?: 'ACTIVE' | 'INACTIVE', category?: ClsRoomCategory) {
    return unwrap<Room[]>(apiClient.get('/rooms/cls', { params: { status, category } }));
  },
  create(input: SaveClsRoomRequest) {
    return unwrapResult<Room>(apiClient.post('/rooms/cls', input));
  },
  update(id: string, input: SaveClsRoomRequest) {
    return unwrapResult<Room>(apiClient.put(`/rooms/cls/${id}`, input));
  },
  activate(id: string) {
    return unwrapResult<Room>(apiClient.patch(`/rooms/cls/${id}/activate`));
  },
  deactivate(id: string, confirm = false) {
    return unwrapResult<DeactivateClsRoomResponse>(apiClient.patch(`/rooms/cls/${id}/deactivate`, { confirm }));
  },
};
