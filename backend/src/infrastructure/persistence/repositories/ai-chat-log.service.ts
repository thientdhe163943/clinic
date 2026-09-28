import { Injectable, Logger } from '@nestjs/common';
import { AiChatLogEntry, AiChatLogInput, AiChatLogPort } from '../../../application/ports/ai-chat-log.port';
import { PrismaService } from '../prisma/prisma.service';

// Caps how much history a single reload can pull back — a chat widget
// session is meant to be a short-lived conversation, not an unbounded log;
// this also bounds the prompt-building cost in ChatWithAiUseCase indirectly
// (that use-case only resends the last few turns anyway, this is purely for
// what the FE renders on reload).
const MAX_HISTORY_MESSAGES = 100;

@Injectable()
export class AiChatLogService implements AiChatLogPort {
  private readonly logger = new Logger(AiChatLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async write(input: AiChatLogInput): Promise<void> {
    try {
      await this.prisma.aiChatLog.create({
        data: {
          userId: input.userId ?? null,
          sessionId: input.sessionId,
          role: input.role,
          message: input.message,
          suggestedSpecialtyId: input.suggestedSpecialtyId ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : String(error));
    }
  }

  async findBySessionId(sessionId: string): Promise<AiChatLogEntry[]> {
    const rows = await this.prisma.aiChatLog.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, message: true, createdAt: true },
    });
    return rows.map((row) => ({ role: row.role as AiChatLogEntry['role'], message: row.message, createdAt: row.createdAt }));
  }
}
