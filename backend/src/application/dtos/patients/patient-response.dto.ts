import { Gender } from '../../../domain/enums/gender.enum';
import { Patient } from '../../../domain/entities/patient.entity';

export class PatientResponseDto {
  id!: string;
  patientCode!: string;
  fullName!: string;
  email!: string | null;
  dateOfBirth!: Date;
  gender!: Gender;
  phone!: string;
  idCard!: string;
  address!: string | null;
  note!: string | null;
  notificationConsent!: boolean;
  userId!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export function toPatientResponse(patient: Patient): PatientResponseDto {
  return {
    id: patient.id,
    patientCode: patient.patientCode,
    fullName: patient.fullName,
    email: patient.email,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    phone: patient.phone,
    idCard: patient.idCard,
    address: patient.address,
    note: patient.note,
    notificationConsent: patient.notificationConsent,
    userId: patient.userId,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
  };
}
