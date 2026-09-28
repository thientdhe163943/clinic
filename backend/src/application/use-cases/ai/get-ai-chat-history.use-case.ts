import { Inject, Injectable } from '@nestjs/common';
import { AiChatHistoryEntryDto } from '../../dtos/ai/ai-chat.dto';
import { AI_CHAT_LOG_PORT, AiChatLogPort } from '../../ports/ai-chat-log.port';

@Injectable()
export class GetAiChatHistoryUseCase {
  constructor(@Inject(AI_CHAT_LOG_PORT) private readonly chatLog: AiChatLogPort) {}

  async execute(sessionId: string): Promise<AiChatHistoryEntryDto[]> {
    const entries = await this.chatLog.findBySessionId(sessionId);
    return entries.map((entry) => ({
      from: entry.role === 'USER' ? 'user' : 'bot',
      text: entry.message,
      createdAt: entry.createdAt.toISOString(),
    }));
  }
}
