import { apiClient, unwrap } from '../client';
import type { ExaminationResult } from '@/types/visits';

export const resultsApi = {
  getByCode(code: string) {
    return unwrap<ExaminationResult>(apiClient.get('/results', { params: { code } }));
  },

  printUrl(code: string) {
    return `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/results/print?code=${encodeURIComponent(code)}`;
  },
};
