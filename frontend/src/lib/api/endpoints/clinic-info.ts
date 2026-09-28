import { apiClient, unwrap } from '../client';
import type { ClinicInfo } from '@/types/clinic-info';

export const clinicInfoApi = {
  get() {
    return unwrap<ClinicInfo>(apiClient.get('/public/clinic-info'));
  },
};
