import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiMessage, AiProviderPort } from '../../application/ports/ai-provider.port';
import { AiProviderUnavailableError } from '../../application/errors/application-error';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

interface GroqChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

// Groq exposes an OpenAI-compatible Chat Completions API for free,
// open-weight models (Llama 3.3 by default) — see console.groq.com. Called
// via plain fetch (no SDK dependency) to keep the adapter small; swap this
// class for a different AiProviderPort implementation if the provider ever
// changes (see docs/features/sprint4/13_ai_chatbot.md).
@Injectable()
export class GroqAiProviderAdapter implements AiProviderPort {
  private readonly logger = new Logger(GroqAiProviderAdapter.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('ai.groqApiKey') || undefined;
    this.model = this.configService.get<string>('ai.groqModel') ?? 'llama-3.3-70b-versatile';
  }

  async chat(messages: AiMessage[]): Promise<string> {
    if (!this.apiKey) {
      this.logger.warn('GROQ_API_KEY chưa được cấu hình — không thể gọi trợ lý AI.');
      throw new AiProviderUnavailableError();
    }

    let response: Response;
    try {
      response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 700,
        }),
      });
    } catch (error) {
      this.logger.error(`Groq request failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new AiProviderUnavailableError();
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Groq API returned ${response.status}: ${body}`);
      throw new AiProviderUnavailableError();
    }

    const data = (await response.json()) as GroqChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      this.logger.error('Groq response had no content.');
      throw new AiProviderUnavailableError();
    }

    return content;
  }
}
