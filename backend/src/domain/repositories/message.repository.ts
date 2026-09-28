import { AppMessage } from '../entities/app-message.entity';

export const MESSAGE_REPOSITORY = Symbol('MESSAGE_REPOSITORY');

export interface MessageRepository {
  findByCode(messageCode: string, locale: string): Promise<AppMessage | null>;
}
