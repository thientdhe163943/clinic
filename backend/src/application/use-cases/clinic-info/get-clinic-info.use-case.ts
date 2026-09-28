import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClinicInfoResponseDto } from '../../dtos/clinic-info/clinic-info-response.dto';
import { ListSpecialtiesUseCase } from '../doctor-specialties/list-specialties.use-case';

@Injectable()
export class GetClinicInfoUseCase {
  constructor(
    private readonly configService: ConfigService,
    private readonly listSpecialtiesUseCase: ListSpecialtiesUseCase,
  ) {}

  async execute(): Promise<ClinicInfoResponseDto> {
    const specialties = await this.listSpecialtiesUseCase.execute();

    return {
      name: this.configService.get<string>('clinic.name')!,
      description: this.configService.get<string>('clinic.description')!,
      address: this.configService.get<string>('clinic.address')!,
      phone: this.configService.get<string>('clinic.phone')!,
      supportPhone: this.configService.get<string>('clinic.supportPhone')!,
      email: this.configService.get<string>('clinic.email')!,
      operatingHours: this.configService.get<string>('clinic.operatingHours')!,
      examinationSteps: this.configService.get<string[]>('clinic.examinationSteps')!,
      specialties,
    };
  }
}
