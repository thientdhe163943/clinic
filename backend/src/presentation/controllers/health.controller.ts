import { Controller, Get } from '@nestjs/common';
import { Public } from '../decorators/public.decorator';
import { SkipAudit } from '../decorators/skip-audit.decorator';

@Public()
@SkipAudit()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'clinic-backend',
      uptime: process.uptime(),
    };
  }
}
