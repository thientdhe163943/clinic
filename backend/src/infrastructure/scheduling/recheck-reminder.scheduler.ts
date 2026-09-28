import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RunRecheckReminderUseCase } from '../../application/use-cases/ai/run-recheck-reminder.use-case';

// Feature 89 main flow step 1: "Batch job chạy hàng ngày (02:00 AM)". A
// scheduler failure (e.g. a transient DB blip) is only logged — it must
// never crash the process, since this runs unattended overnight.
@Injectable()
export class RecheckReminderScheduler {
  private readonly logger = new Logger(RecheckReminderScheduler.name);

  constructor(private readonly runRecheckReminderUseCase: RunRecheckReminderUseCase) {}

  // Explicit timeZone: the server process itself may run in UTC (e.g. cloud
  // deployment) even though every other clinic-time computation in this
  // codebase assumes Vietnam wall-clock (see clinic-calendar.util.ts) —
  // without this the job would fire at 02:00 server time, not 02:00 Vietnam.
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    try {
      const result = await this.runRecheckReminderUseCase.execute();
      this.logger.log(`Daily recheck reminder job done: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`Daily recheck reminder job failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
