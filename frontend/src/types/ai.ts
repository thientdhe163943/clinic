export interface AiChatHistoryMessage {
  from: 'user' | 'bot';
  text: string;
}

export interface AiChatRequest {
  sessionId: string;
  message: string;
  history?: AiChatHistoryMessage[];
}

export interface SuggestedSpecialty {
  id: string;
  name: string;
}

export interface SuggestedSlot {
  doctorId: string;
  doctorName: string;
  serviceId: string;
  roomId: string | null;
  roomName: string | null;
  time: string;
  datetime: string;
  score: number;
  bookedCount: number;
  totalSlots: number;
  reason: string;
}

export interface AiChatResponse {
  reply: string;
  suggestedSpecialties: SuggestedSpecialty[];
  suggestedSlots: SuggestedSlot[];
  disclaimer: string;
}

export interface AiChatHistoryEntry {
  from: 'user' | 'bot';
  text: string;
  createdAt: string;
}

export interface SummarizeExamResultResponse {
  visitId: string;
  summary: string;
  disclaimer: string;
}
