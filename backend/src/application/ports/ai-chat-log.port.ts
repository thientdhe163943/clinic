export const AI_CHAT_LOG_PORT = Symbol('AI_CHAT_LOG_PORT');

export type AiChatRole = 'USER' | 'ASSISTANT';

export interface AiChatLogInput {
  userId?: string | null;
  sessionId: string;
  role: AiChatRole;
  message: string;
  suggestedSpecialtyId?: string | null;
}

export interface AiChatLogEntry {
  role: AiChatRole;
  message: string;
  createdAt: Date;
}

/**
 * Writes an ai_chat_logs row for every turn (user question + assistant
 * answer) — Feature 83/86 business rule: "Ghi log câu hỏi vào bảng
 * ai_chat_logs để cải thiện model" / audit unanswered FAQ questions. A
 * logging failure never blocks the chat response (same fire-and-forget
 * contract as AuditLogPort).
 */
export interface AiChatLogPort {
  write(input: AiChatLogInput): Promise<void>;
  /** Chronological (oldest first) turns for one chat widget session, so a
   * page reload can restore the conversation instead of starting over. */
  findBySessionId(sessionId: string): Promise<AiChatLogEntry[]>;
}
