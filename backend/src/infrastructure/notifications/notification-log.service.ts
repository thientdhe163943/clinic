import { Inject, Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { EMAIL_PORT, EmailPort } from '../../application/ports/email.port';
import { NotificationPort, NotifyInput } from '../../application/ports/notification.port';
import { REALTIME_PORT, RealtimePort } from '../../application/ports/realtime.port';
import { PrismaService } from '../persistence/prisma/prisma.service';

// Real implementation of NotificationPort: always writes a notification_logs
// row first (PENDING), then dispatches via EmailPort, then updates the row
// to SENT or FAILED. EmailPort itself is still a console stub until real
// SMTP credentials are configured (see ConsoleEmailAdapter) — this service
// is what makes the dispatch *attempt* and the audit trail real, independent
// of that.
@Injectable()
export class NotificationLogService implements NotificationPort {
  private readonly logger = new Logger(NotificationLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_PORT) private readonly emailPort: EmailPort,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    let logId: string;
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          userId: input.userId ?? null,
          recipient: input.recipient,
          channel: input.channel as NotificationChannel,
          type: input.type,
          subject: input.subject ?? null,
          body: input.body,
          status: NotificationStatus.PENDING,
          refId: input.refId ?? null,
        },
      });
      logId = log.id;
    } catch (error) {
      // Can't even record the attempt — log and give up quietly (never
      // block the calling use case for a notification failure).
      this.logger.warn(`Failed to create notification_logs row: ${this.errorMessage(error)}`);
      return;
    }

    // Push a realtime "you have a new notification" signal to the bell icon
    // for whichever user this notification was addressed to. Guest/anonymous
    // notifications (no userId) have no socket room to target, so they're
    // skipped — this in no way affects the email dispatch below.
    if (input.userId) {
      try {
        this.realtimePort.emit(input.userId, 'notification:created', { notificationId: logId });
      } catch {
        // Realtime notification is best-effort — never let it fail the write.
      }
    }

    try {
      await this.emailPort.send({ to: input.recipient, subject: input.subject ?? input.type, body: input.body });
      await this.prisma.notificationLog.update({
        where: { id: logId },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notificationLog
        .update({
          where: { id: logId },
          data: {
            status: NotificationStatus.FAILED,
            errorMsg: this.errorMessage(error),
            retryCount: { increment: 1 },
          },
        })
        .catch((updateError) =>
          this.logger.warn(`Failed to mark notification_logs FAILED: ${this.errorMessage(updateError)}`),
        );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
