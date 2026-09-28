export const AI_PROVIDER_PORT = Symbol('AI_PROVIDER_PORT');

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderPort {
  chat(messages: AiMessage[]): Promise<string>;
}
