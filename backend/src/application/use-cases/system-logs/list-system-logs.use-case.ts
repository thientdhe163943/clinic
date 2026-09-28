import { Inject, Injectable } from '@nestjs/common';
import {
  SYSTEM_LOG_REPOSITORY,
  SystemLogFilters,
  SystemLogRepository,
} from '../../../domain/repositories/system-log.repository';
import { buildPaginationMeta, PaginationMeta } from '../../dtos/pagination.dto';
import { SystemLogResponseDto } from '../../dtos/system-logs/system-log-response.dto';

export interface ListSystemLogsInput {
  userId?: string;
  from?: Date;
  to?: Date;
  action?: string;
  module?: string;
  page: number;
  limit: number;
  skip: number;
}

export interface ListSystemLogsResult {
  items: SystemLogResponseDto[];
  meta: PaginationMeta;
}

// Feature 82 — Admin-only, read-only view of system_logs. Default sort is
// newest-first per spec ("mặc định mới nhất trước"), enforced in the Prisma
// repository's orderBy.
@Injectable()
export class ListSystemLogsUseCase {
  constructor(@Inject(SYSTEM_LOG_REPOSITORY) private readonly systemLogRepository: SystemLogRepository) {}

  async execute(input: ListSystemLogsInput): Promise<ListSystemLogsResult> {
    const filters: SystemLogFilters = {
      userId: input.userId,
      from: input.from,
      to: input.to,
      action: input.action,
      module: input.module,
    };

    const [items, total] = await Promise.all([
      this.systemLogRepository.findMany(filters, input.skip, input.limit),
      this.systemLogRepository.count(filters),
    ]);

    return {
      items: items.map(({ log, actorName }) => ({
        id: log.id,
        createdAt: log.createdAt,
        userId: log.userId,
        actorName,
        action: log.action,
        module: log.module,
        targetId: log.targetId,
        ipAddress: log.ipAddress,
        detail: log.detail,
      })),
      meta: buildPaginationMeta(input.page, input.limit, total),
    };
  }
}
