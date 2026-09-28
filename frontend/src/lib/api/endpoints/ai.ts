import { apiClient, unwrap } from '../client';
import type { AiChatHistoryEntry, AiChatRequest, AiChatResponse, SummarizeExamResultResponse } from '@/types/ai';

export const aiApi = {
  // Mutation, but uses `unwrap` (not `unwrapResult`) — a chat reply has no
  // toast-worthy backend message to surface, only the reply payload.
  chat(input: AiChatRequest) {
    return unwrap<AiChatResponse>(apiClient.post('/ai/chat', input));
  },
  getHistory(sessionId: string) {
    return unwrap<AiChatHistoryEntry[]>(apiClient.get(`/ai/chat/${sessionId}/history`));
  },
  summarizeResult(visitId: string) {
    return unwrap<SummarizeExamResultResponse>(apiClient.get(`/ai/summarize-result/${visitId}`));
  },
};
