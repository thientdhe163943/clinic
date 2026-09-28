import {
  MedicalRecordAllergy,
  MedicalRecordPatientInfo,
  MedicalRecordVisit,
} from '../../../domain/repositories/medical-record.repository';

export interface PrintMedicalRecordResponseDto {
  patient: MedicalRecordPatientInfo;
  allergies: MedicalRecordAllergy[];
  visits: MedicalRecordVisit[];
}
