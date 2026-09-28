import { DoctorSlotService } from './doctor-slot.service';
import { WorkSchedule } from '../../domain/entities/work-schedule.entity';
import { Appointment } from '../../domain/entities/appointment.entity';
import { AppointmentStatus } from '../../domain/enums/appointment-status.enum';
import { ShiftType } from '../../domain/enums/shift-type.enum';
import { AppointmentListItem } from '../../domain/repositories/appointment.repository';
import { WorkScheduleListItem } from '../../domain/repositories/work-schedule.repository';

function buildSchedule(overrides: Partial<WorkSchedule> = {}): WorkSchedule {
  return new WorkSchedule(
    overrides.id ?? 'schedule-1',
    overrides.userId ?? 'doctor-1',
    overrides.roomId ?? 'room-1',
    overrides.workDate ?? new Date('2999-01-01'),
    overrides.shift ?? ShiftType.MORNING,
    overrides.note ?? null,
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
    overrides.createdBy ?? 'admin-1',
    overrides.updatedBy ?? null,
  );
}

function buildScheduleListItem(overrides: Partial<WorkScheduleListItem> = {}): WorkScheduleListItem {
  return {
    schedule: overrides.schedule ?? buildSchedule(),
    userName: overrides.userName ?? 'Bac Si A',
    userRole: overrides.userRole ?? 'DOCTOR',
    roomCode: overrides.roomCode ?? 'R1',
    roomName: overrides.roomName ?? 'Phong 1',
  };
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return new Appointment(
    overrides.id ?? 'appointment-1',
    overrides.patientId ?? 'patient-1',
    overrides.doctorId ?? 'doctor-1',
    overrides.serviceId ?? 'service-1',
    overrides.roomId ?? 'room-1',
    overrides.scheduleId ?? 'schedule-1',
    overrides.appointmentTime ?? new Date('2999-01-01T07:00:00.000Z'),
    overrides.status ?? AppointmentStatus.CONFIRMED,
    overrides.note ?? null,
    overrides.cancelReason ?? null,
    overrides.cancelledBy ?? null,
    overrides.cancelledAt ?? null,
    overrides.checkedInAt ?? null,
    overrides.bookedBy ?? 'patient-1',
    overrides.createdAt ?? new Date(),
    overrides.updatedAt ?? new Date(),
  );
}

function buildAppointmentListItem(overrides: Partial<AppointmentListItem> = {}): AppointmentListItem {
  return {
    appointment: overrides.appointment ?? buildAppointment(),
    patientName: overrides.patientName ?? 'Nguyen Van A',
    patientCode: overrides.patientCode ?? 'PT000001',
    doctorName: overrides.doctorName ?? 'Bac Si A',
    serviceName: overrides.serviceName ?? 'Kham tong quat',
    visitId: overrides.visitId ?? null,
    roomName: overrides.roomName ?? 'Phong 1',
  };
}

describe('DoctorSlotService', () => {
  function buildService(overrides?: { findManySchedules?: jest.Mock; findManyAppointments?: jest.Mock }) {
    const workScheduleRepository = {
      findMany: overrides?.findManySchedules ?? jest.fn().mockResolvedValue([]),
    };
    const appointmentRepository = {
      findMany: overrides?.findManyAppointments ?? jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    const service = new DoctorSlotService(workScheduleRepository as never, appointmentRepository as never);
    return { service, workScheduleRepository, appointmentRepository };
  }

  describe('buildSlots', () => {
    it('marks a slot unavailable when it matches an entry in bookedTimes, leaving other slots available', () => {
      const { service } = buildService();
      const day = new Date(Date.UTC(2999, 0, 1));
      const bookedSlotTime = Date.UTC(2999, 0, 1, 7, 20);

      const slots = service.buildSlots(day, 7, 8, new Set([bookedSlotTime]));

      const bookedSlot = slots.find((s) => s.time === '07:20');
      const otherSlot = slots.find((s) => s.time === '07:00');
      expect(bookedSlot?.available).toBe(false);
      expect(otherSlot?.available).toBe(true);
    });

    // Alternative flow: a slot that has already passed "now" cannot be
    // booked, even when nothing is booked into it.
    it('marks every slot unavailable for a day entirely in the past', () => {
      const { service } = buildService();
      const day = new Date(Date.UTC(2000, 0, 1));

      const slots = service.buildSlots(day, 7, 8, new Set());

      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.available === false)).toBe(true);
    });
  });

  describe('getShiftsWithSlots', () => {
    it('excludes CANCELLED appointments from the booked-times set (their slot stays bookable)', async () => {
      const day = new Date(Date.UTC(2999, 0, 1));
      const schedule = buildScheduleListItem({
        schedule: buildSchedule({ workDate: day, shift: ShiftType.MORNING }),
      });
      const cancelledAppointment = buildAppointmentListItem({
        appointment: buildAppointment({
          status: AppointmentStatus.CANCELLED,
          appointmentTime: new Date(Date.UTC(2999, 0, 1, 7, 0)),
        }),
      });

      const { service } = buildService({
        findManySchedules: jest.fn().mockResolvedValue([schedule]),
        findManyAppointments: jest.fn().mockResolvedValue({ items: [cancelledAppointment], total: 1 }),
      });

      const shifts = await service.getShiftsWithSlots('doctor-1', day);

      expect(shifts).toHaveLength(1);
      const slotAtCancelledTime = shifts[0].slots.find((s) => s.time === '07:00');
      expect(slotAtCancelledTime?.available).toBe(true);
    });

    it('does not query appointments at all when the doctor has no shift that day', async () => {
      const day = new Date(Date.UTC(2999, 0, 1));
      const findManyAppointments = jest.fn();
      const { service } = buildService({
        findManySchedules: jest.fn().mockResolvedValue([]),
        findManyAppointments,
      });

      const shifts = await service.getShiftsWithSlots('doctor-1', day);

      expect(shifts).toEqual([]);
      expect(findManyAppointments).not.toHaveBeenCalled();
    });
  });

  describe('hasAvailableSlot', () => {
    it('returns false when the doctor has no shift on that day', async () => {
      const { service } = buildService({ findManySchedules: jest.fn().mockResolvedValue([]) });

      await expect(service.hasAvailableSlot('doctor-1', new Date(Date.UTC(2999, 0, 1)))).resolves.toBe(false);
    });

    it('returns true when the doctor has at least one bookable slot that day', async () => {
      const day = new Date(Date.UTC(2999, 0, 1));
      const schedule = buildScheduleListItem({
        schedule: buildSchedule({ workDate: day, shift: ShiftType.MORNING }),
      });
      const { service } = buildService({
        findManySchedules: jest.fn().mockResolvedValue([schedule]),
        findManyAppointments: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      });

      await expect(service.hasAvailableSlot('doctor-1', day)).resolves.toBe(true);
    });
  });
});
