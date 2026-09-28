import { apiClient, unwrap, unwrapResult } from '../client';
import type { CreatePrescriptionRequest, UpdatePrescriptionRequest, Prescription } from '@/types/visits';

export const prescriptionsApi = {
  getByVisit(visitId: string) {
    return unwrap<Prescription | null>(apiClient.get('/prescriptions', { params: { visitId } }));
  },

  create(input: CreatePrescriptionRequest) {
    return unwrapResult<Prescription>(apiClient.post('/prescriptions', input));
  },

  update(id: string, input: UpdatePrescriptionRequest) {
    return unwrapResult<Prescription>(apiClient.patch(`/prescriptions/${id}`, input));
  },

  printUrl(id: string) {
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/prescriptions/${id}/print`;
  },
};
