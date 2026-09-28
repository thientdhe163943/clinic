import { ShiftType } from '../enums/shift-type.enum';

// Feature 39 business rule (gap phát hiện + sửa 2026-07-09): FULL_DAY bao
// trùm cả MORNING và AFTERNOON về mặt thời gian thật (xem SHIFT_HOURS trong
// prisma-work-schedule.repository.ts), nên phải được coi là chồng lấn khi
// chặn trùng — trước đây rule chặn dùng exact-match trên `shift`, khiến 1
// nhân viên/phòng có thể bị xếp cả FULL_DAY và MORNING cùng ngày mà không
// bị chặn.
const OVERLAPPING_SHIFTS: Record<ShiftType, ShiftType[]> = {
  [ShiftType.MORNING]: [ShiftType.MORNING, ShiftType.FULL_DAY],
  [ShiftType.AFTERNOON]: [ShiftType.AFTERNOON, ShiftType.FULL_DAY],
  [ShiftType.FULL_DAY]: [ShiftType.MORNING, ShiftType.AFTERNOON, ShiftType.FULL_DAY],
};

export function overlappingShifts(shift: ShiftType): ShiftType[] {
  return OVERLAPPING_SHIFTS[shift];
}
