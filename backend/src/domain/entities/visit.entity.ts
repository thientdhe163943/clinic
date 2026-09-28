import { VisitPriority } from '../enums/visit-priority.enum';
import { VisitStatus } from '../enums/visit-status.enum';

export class Visit {
  constructor(
    public readonly id: string,
    public readonly appointmentId: string,
    public readonly patientId: string,
    public readonly doctorId: string,
    public readonly roomId: string,
    public readonly queueNumber: string | null,
    public readonly priority: VisitPriority,
    public readonly status: VisitStatus,
    public readonly calledAt: Date | null,
    public readonly calledCount: number,
    public readonly startedAt: Date | null,
    public readonly completedAt: Date | null,
    public readonly createdAt: Date,
  ) {}
}
