import { Injectable } from '@nestjs/common';
import { CreateBulkScheduleRequestDto } from '../../dtos/schedules/create-bulk-schedule.dto';
import { ScheduleResponseDto } from '../../dtos/schedules/schedule-response.dto';
import { ApplicationError, LeaveDateRangeInvalidError } from '../../errors/application-error';
import { CreateScheduleUseCase } from './create-schedule.use-case';

export interface CreateBulkScheduleInput extends CreateBulkScheduleRequestDto {
  createdBy: string;
}

export interface BulkScheduleSkip {
  date: string;
  reason: string;
}

export interface BulkScheduleResultDto {
  created: ScheduleResponseDto[];
  skipped: BulkScheduleSkip[];
}

// Feature 39 (bổ sung 2026-07-09): tạo lịch lặp lại theo tuần trong 1 lần
// submit thay vì admin phải bấm từng ngày — best-effort, không atomic: mỗi
// ngày dùng lại đúng validation của CreateScheduleUseCase (trùng nhân
// viên/phòng, nghỉ phép, ngày quá khứ...), ngày nào bị lỗi thì bỏ qua và
// ghi lý do, không làm hỏng các ngày còn lại.
const MAX_RANGE_DAYS = 62;

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class CreateBulkScheduleUseCase {
  constructor(private readonly createScheduleUseCase: CreateScheduleUseCase) {}

  async execute(input: CreateBulkScheduleInput): Promise<BulkScheduleResultDto> {
    const fromDate = toDateOnly(input.fromDate);
    const toDate = toDateOnly(input.toDate);
    if (toDate < fromDate) throw new LeaveDateRangeInvalidError();

    const daysOfWeek = new Set(input.daysOfWeek);
    const created: ScheduleResponseDto[] = [];
    const skipped: BulkScheduleSkip[] = [];

    let cursor = fromDate;
    let iterations = 0;
    while (cursor <= toDate) {
      if (++iterations > MAX_RANGE_DAYS) break;

      if (daysOfWeek.has(cursor.getUTCDay())) {
        const dateLabel = cursor.toISOString().slice(0, 10);
        try {
          // eslint-disable-next-line no-await-in-loop -- intentionally sequential: reuses the single-create use case's own conflict checks, which must see prior iterations' writes.
          const schedule = await this.createScheduleUseCase.execute({
            userId: input.userId,
            roomId: input.roomId,
            shift: input.shift,
            workDate: cursor,
            note: input.note,
            createdBy: input.createdBy,
          });
          created.push(schedule);
        } catch (error) {
          skipped.push({
            date: dateLabel,
            reason: error instanceof ApplicationError ? error.code : 'UNKNOWN_ERROR',
          });
        }
      }

      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 1));
    }

    return { created, skipped };
  }
}
