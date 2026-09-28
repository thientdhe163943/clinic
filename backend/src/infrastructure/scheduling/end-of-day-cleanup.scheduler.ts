import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RunEndOfDayCleanupUseCase } from '../../application/use-cases/appointments/run-end-of-day-cleanup.use-case';

// Runs shortly after midnight so the previous day's leftover appointments
// (PENDING/CONFIRMED/CHECKED_IN/IN_PROGRESS) and visits (WAITING/CALLED/
// IN_PROGRESS/AWAITING_RESULTS) are auto-cancelled before staff start the
// new day.
// A scheduler failure (e.g. a transient DB blip) is only logged — it must
// never crash the process, since this runs unattended overnight.
@Injectable()
export class EndOfDayCleanupScheduler {
  private readonly logger = new Logger(EndOfDayCleanupScheduler.name);

  constructor(private readonly runEndOfDayCleanupUseCase: RunEndOfDayCleanupUseCase) {}

  // Explicit timeZone: the server process itself may run in UTC (e.g. cloud
  // deployment) even though every other clinic-time computation in this
  // codebase assumes Vietnam wall-clock (see clinic-calendar.util.ts).
  @Cron('5 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCron(): Promise<void> {
    try {
      const result = await this.runEndOfDayCleanupUseCase.execute();
      this.logger.log(`End-of-day cleanup job done: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error(`End-of-day cleanup job failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
