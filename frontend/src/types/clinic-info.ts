import type { SpecialtyOption } from './doctor-specialties';

export interface ClinicInfo {
  name: string;
  description: string;
  address: string;
  phone: string;
  supportPhone: string;
  email: string;
  operatingHours: string;
  examinationSteps: string[];
  specialties: SpecialtyOption[];
}
