import { Injectable } from '@nestjs/common';
import { Notification } from '../../../domain/entities/notification.entity';
import { NotificationRepository } from '../../../domain/repositories/notification.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string, limit: number): Promise<Notification[]> {
    const rows = await this.prisma.notificationLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => this.toDomain(row));
  }

  async countUnread(userId: string): Promise<number> {
    return this.prisma.notificationLog.count({ where: { userId, isRead: false } });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.prisma.notificationLog.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notificationLog.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async findByType(type: string, page: number, limit: number): Promise<{ items: Notification[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notificationLog.findMany({
        where: { type },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationLog.count({ where: { type } }),
    ]);
    return { items: rows.map((row) => this.toDomain(row)), total };
  }

  private toDomain(row: {
    id: string;
    userId: string | null;
    recipient: string;
    channel: string;
    type: string;
    subject: string | null;
    body: string;
    status: string;
    sentAt: Date | null;
    refId: string | null;
    isRead: boolean;
    createdAt: Date;
  }): Notification {
    return new Notification(
      row.id,
      row.userId,
      row.recipient,
      row.channel,
      row.type,
      row.subject,
      row.body,
      row.status,
      row.sentAt,
      row.refId,
      row.isRead,
      row.createdAt,
    );
  }
}
