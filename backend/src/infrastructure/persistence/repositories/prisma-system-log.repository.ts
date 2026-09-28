import { Injectable } from '@nestjs/common';
import { Prisma, SystemLog as PrismaSystemLog } from '@prisma/client';
import { SystemLog } from '../../../domain/entities/system-log.entity';
import {
  SystemLogFilters,
  SystemLogListItem,
  SystemLogRepository,
} from '../../../domain/repositories/system-log.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaSystemLogRepository implements SystemLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(filters: SystemLogFilters, skip: number, take: number): Promise<SystemLogListItem[]> {
    const rows = await this.prisma.systemLog.findMany({
      where: this.buildWhere(filters),
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    // system_logs.user_id has no Prisma relation to users (it must stay
    // populatable even when the user is unknown/deleted, e.g. failed-login
    // attempts against a non-existent account), so actor names are resolved
    // with a separate batched lookup instead of `include`.
    const userIds = [...new Set(rows.map((row) => row.userId).filter((id): id is string => id !== null))];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
      : [];
    const nameById = new Map(users.map((user) => [user.id, user.fullName]));

    return rows.map((row) => ({
      log: this.toDomain(row),
      actorName: row.userId ? (nameById.get(row.userId) ?? null) : null,
    }));
  }

  async count(filters: SystemLogFilters): Promise<number> {
    return this.prisma.systemLog.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(filters: SystemLogFilters): Prisma.SystemLogWhereInput {
    return {
      ...(filters.userId !== undefined && { userId: filters.userId }),
      ...(filters.action !== undefined && { action: filters.action }),
      ...(filters.module !== undefined && { module: filters.module }),
      ...((filters.from !== undefined || filters.to !== undefined) && {
        createdAt: {
          ...(filters.from !== undefined && { gte: filters.from }),
          ...(filters.to !== undefined && { lte: filters.to }),
        },
      }),
    };
  }

  private toDomain(row: PrismaSystemLog): SystemLog {
    return new SystemLog(
      row.id,
      row.userId,
      row.action,
      row.module,
      row.targetId,
      (row.detail as Record<string, unknown> | null) ?? null,
      row.ipAddress,
      row.userAgent,
      row.createdAt,
    );
  }
}
