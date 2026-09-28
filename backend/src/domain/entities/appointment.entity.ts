import { AppointmentStatus } from '../enums/appointment-status.enum';

export class Appointment {
  constructor(
    public readonly id: string,
    public readonly patientId: string,
    public readonly doctorId: string | null,
    public readonly serviceId: string | null,
    public readonly roomId: string | null,
    public readonly scheduleId: string | null,
    public readonly appointmentTime: Date,
    public readonly status: AppointmentStatus,
    public readonly note: string | null,
    public readonly cancelReason: string | null,
    public readonly cancelledBy: string | null,
    public readonly cancelledAt: Date | null,
    public readonly checkedInAt: Date | null,
    public readonly bookedBy: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}
}
