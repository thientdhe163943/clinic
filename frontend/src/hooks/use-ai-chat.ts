'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { aiApi } from '@/lib/api/endpoints/ai';
import type { AiChatHistoryEntry, AiChatRequest, AiChatResponse, SummarizeExamResultResponse } from '@/types/ai';
import type { ApiError } from '@/types/api';

export function useAiChat() {
  return useMutation<AiChatResponse, ApiError, AiChatRequest>({
    mutationFn: (input: AiChatRequest) => aiApi.chat(input),
  });
}

// Fetched once on widget mount to restore a session persisted in
// localStorage — disabled (no fetch) for a brand-new session id that has no
// history yet.
export function useAiChatHistory(sessionId: string | null) {
  return useQuery<AiChatHistoryEntry[], ApiError>({
    queryKey: ['ai-chat-history', sessionId],
    queryFn: () => aiApi.getHistory(sessionId as string),
    enabled: !!sessionId,
    staleTime: Infinity,
  });
}

// `enabled` only turns true once the patient opens the "Tóm tắt bằng AI"
// modal for a given visit — mirrors useMedicalRecordPrint's on-demand GET
// pattern rather than firing for every visit up front.
export function useSummarizeExamResult(visitId: string | null, enabled: boolean) {
  return useQuery<SummarizeExamResultResponse, ApiError>({
    queryKey: ['ai', 'summarize-result', visitId],
    queryFn: () => aiApi.summarizeResult(visitId as string),
    enabled: enabled && !!visitId,
    staleTime: Infinity,
  });
}
