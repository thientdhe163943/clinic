import { apiClient, unwrap } from '../client';
import type { ListPublicDoctorsQuery, PublicDoctorDetail, PublicDoctorListItem } from '@/types/public-doctors';

export const publicDoctorsApi = {
  list(params?: ListPublicDoctorsQuery) {
    return unwrap<PublicDoctorListItem[]>(apiClient.get('/public/doctors', { params }));
  },

  getById(id: string) {
    return unwrap<PublicDoctorDetail>(apiClient.get(`/public/doctors/${id}`));
  },
};
