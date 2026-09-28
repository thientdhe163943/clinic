import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogInput, AuditLogPort } from '../../../application/ports/audit-log.port';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService implements AuditLogPort {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async write(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.systemLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          module: input.module,
          targetId: input.targetId ?? null,
          detail: (input.detail ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : String(error));
    }
  }
}
