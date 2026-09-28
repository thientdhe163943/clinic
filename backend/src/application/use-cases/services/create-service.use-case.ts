import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  ServiceClsCategoryNotAllowedError,
  ServiceClsCategoryRequiredError,
  ServiceSpecialtyMissingError,
} from '../../errors/application-error';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { ServiceResponseDto } from '../../dtos/services/service-response.dto';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { Service } from '../../../domain/entities/service.entity';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { Money } from '../../../domain/value-objects/money.vo';

export interface CreateServiceInput {
  name: string;
  specialtyId?: string | null;
  type?: ServiceType;
  clsCategory?: ClsRoomCategory | null;
  price: number;
  description?: string | null;
  createdBy: string;
}

@Injectable()
export class CreateServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: CreateServiceInput): Promise<ServiceResponseDto> {
    const price = Money.of(input.price);
    const type = input.type ?? ServiceType.EXAMINATION;

    if (type === ServiceType.CLS && !input.clsCategory) {
      throw new ServiceClsCategoryRequiredError();
    }
    if (type === ServiceType.EXAMINATION && input.clsCategory) {
      throw new ServiceClsCategoryNotAllowedError();
    }
    // Booking flow (FindAvailableDoctorsUseCase) requires an EXAMINATION
    // service to carry a specialty to find matching doctors — enforce it at
    // creation time so a service can't be created unbookable.
    if (type === ServiceType.EXAMINATION && !input.specialtyId) {
      throw new ServiceSpecialtyMissingError();
    }

    const existingByName = await this.serviceRepository.findByName(input.name);
    if (existingByName) throw new ConflictError('Tên dịch vụ');

    // Auto-generate service code: DV-00001, DV-00002, ...
    const total = await this.serviceRepository.count();
    let serviceCode = `DV-${String(total + 1).padStart(5, '0')}`;
    // Ensure uniqueness in case of concurrent inserts
    let existingByCode = await this.serviceRepository.findByCode(serviceCode);
    let attempt = total + 2;
    while (existingByCode) {
      serviceCode = `DV-${String(attempt++).padStart(5, '0')}`;
      existingByCode = await this.serviceRepository.findByCode(serviceCode);
    }

    const service = await this.serviceRepository.create({
      serviceCode,
      name: input.name,
      specialtyId: input.specialtyId ?? null,
      type,
      clsCategory: type === ServiceType.CLS ? (input.clsCategory ?? null) : null,
      price: price.amount,
      description: input.description ?? null,
      createdBy: input.createdBy,
    });

    await this.auditLog.write({
      userId: input.createdBy,
      action: 'SERVICE_CREATED',
      module: 'SERVICE',
      targetId: service.id,
    });

    return this.toDto(service);
  }

  private async toDto(service: Service): Promise<ServiceResponseDto> {
    const specialty = service.specialtyId
      ? await this.specialtyRepository.findById(service.specialtyId)
      : null;

    return {
      id: service.id,
      serviceCode: service.serviceCode,
      name: service.name,
      specialtyId: service.specialtyId,
      specialtyName: specialty?.name ?? null,
      type: service.type,
      clsCategory: service.clsCategory,
      price: service.price,
      description: service.description,
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    };
  }
}
