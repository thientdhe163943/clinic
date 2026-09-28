import { SpecialtyOptionResponseDto } from '../doctor-specialties/doctor-specialty-response.dto';

export interface ClinicInfoResponseDto {
  name: string;
  description: string;
  address: string;
  phone: string;
  supportPhone: string;
  email: string;
  operatingHours: string;
  examinationSteps: string[];
  specialties: SpecialtyOptionResponseDto[];
}
