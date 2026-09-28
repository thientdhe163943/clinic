import { ShiftType } from '../enums/shift-type.enum';

export class WorkSchedule {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly roomId: string | null,
    public readonly workDate: Date,
    public readonly shift: ShiftType,
    public readonly note: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly createdBy: string,
    public readonly updatedBy: string | null,
    // Version-up 0.2 Phase 2 #9 (Tình huống B, added 2026-08-19): set by
    // ReassignScheduleDoctorUseCase when ADMIN swaps in a substitute doctor
    // for a shift whose original doctor is absent. isAbsent/absentNote flag
    // the shift itself; originalUserId is only ever set on the *first*
    // reassignment and kept unchanged across any later ones.
    public readonly isAbsent: boolean = false,
    public readonly absentNote: string | null = null,
    public readonly originalUserId: string | null = null,
  ) {}
}
