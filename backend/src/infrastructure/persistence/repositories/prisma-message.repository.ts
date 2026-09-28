import { Injectable } from '@nestjs/common';
import { AppMessage } from '../../../domain/entities/app-message.entity';
import { MessageRepository } from '../../../domain/repositories/message.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(messageCode: string, locale: string): Promise<AppMessage | null> {
    const row = await this.prisma.appMessage.findUnique({
      where: { messageCode_locale: { messageCode, locale } },
    });

    if (!row) return null;
    return new AppMessage(row.id, row.messageCode, row.locale, row.message);
  }
}
