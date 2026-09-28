import { IsEnum, IsOptional } from 'class-validator';
import { VisitPriority } from '../../../domain/enums/visit-priority.enum';

// `roomId` is not a request input — the room is resolved server-side from
// the doctor's work-schedule shift covering the appointment time. No
// deposit/payment fields here — check-in is purely a status transition +
// Visit creation (deposit collection was removed 2026-07-19, and the whole
// deposit feature was later removed entirely, 2026-07-26).
export class CheckInAppointmentRequestDto {
  // Mức ưu tiên hàng đợi của bệnh nhân, gắn lúc check-in. Mặc định NORMAL nếu bỏ trống.
  @IsOptional()
  @IsEnum(VisitPriority)
  priority?: VisitPriority;
}
