import { Inject, Injectable } from '@nestjs/common';
import {
  MESSAGE_REPOSITORY,
  MessageRepository,
} from '../../../domain/repositories/message.repository';
import { DEFAULT_LOCALE } from '../../ports/message-catalog.port';
import { ResourceNotFoundError } from '../../errors/application-error';
import { MessageResponseDto } from '../../dtos/messages/message-response.dto';

@Injectable()
export class GetMessageUseCase {
  constructor(
    @Inject(MESSAGE_REPOSITORY)
    private readonly messageRepository: MessageRepository,
  ) {}

  async execute(messageCode: string, locale = DEFAULT_LOCALE): Promise<MessageResponseDto> {
    const message =
      (await this.messageRepository.findByCode(messageCode, locale)) ??
      (await this.messageRepository.findByCode(messageCode, DEFAULT_LOCALE));

    if (!message) throw new ResourceNotFoundError('Message', { messageCode });

    return {
      messageCode: message.messageCode,
      locale: message.locale,
      message: message.message,
    };
  }
}
