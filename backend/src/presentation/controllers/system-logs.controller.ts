import { Controller, Get, Query } from '@nestjs/common';
import { ListSystemLogsQueryDto } from '../../application/dtos/system-logs/list-system-logs-query.dto';
import {
  ListSystemLogsResult,
  ListSystemLogsUseCase,
} from '../../application/use-cases/system-logs/list-system-logs.use-case';
import { UserRole } from '../../domain/enums/user-role.enum';
import { Roles } from '../decorators/roles.decorator';

// Feature 82 — System Log Management. Read-only; logs are append-only, so
// there are intentionally no update/delete endpoints here.
@Controller('admin/logs')
export class SystemLogsController {
  constructor(private readonly listSystemLogsUseCase: ListSystemLogsUseCase) {}

  @Get()
  @Roles(UserRole.ADMIN)
  list(@Query() query: ListSystemLogsQueryDto): Promise<ListSystemLogsResult> {
    return this.listSystemLogsUseCase.execute({
      userId: query.userId,
      from: query.from,
      to: query.to,
      action: query.action,
      module: query.module,
      page: query.page,
      limit: query.limit,
      skip: query.skip,
    });
  }
}
