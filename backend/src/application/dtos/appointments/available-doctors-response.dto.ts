import { ShiftType } from '../../../domain/enums/shift-type.enum';

export interface AppointmentSlotDto {
  time: string;
  datetime: string;
  available: boolean;
}

export interface AvailableDoctorShiftDto {
  shift: ShiftType;
  roomId: string | null;
  roomName: string | null;
  startHour: number;
  endHour: number;
  slots: AppointmentSlotDto[];
}

export interface AvailableDoctorDto {
  doctorId: string;
  doctorName: string;
  shifts: AvailableDoctorShiftDto[];
}
