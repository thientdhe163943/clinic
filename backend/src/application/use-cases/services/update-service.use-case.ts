import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  ResourceNotFoundError,
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

export interface UpdateServiceInput {
  id: string;
  name?: string;
  specialtyId?: string | null;
  type?: ServiceType;
  // `undefined` = leave unchanged, `null` = explicitly clear back to unset.
  clsCategory?: ClsRoomCategory | null;
  price?: number;
  description?: string | null;
  isActive?: boolean;
  updatedBy: string;
}

@Injectable()
export class UpdateServiceUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  async execute(input: UpdateServiceInput): Promise<ServiceResponseDto> {
    const service = await this.serviceRepository.findById(input.id);
    if (!service) throw new ResourceNotFoundError('Service', { id: input.id });

    if (input.name !== undefined && input.name !== service.name) {
      const existing = await this.serviceRepository.findByName(input.name);
      if (existing) throw new ConflictError('Tên dịch vụ');
    }

    // Resolve the *resulting* type/clsCategory — `??` would silently treat
    // an explicit `clsCategory: null` (clear it) the same as an omitted
    // field (leave unchanged), so both must be resolved via `!== undefined`.
    const resultingType = input.type !== undefined ? input.type : service.type;
    const resultingClsCategory = input.clsCategory !== undefined ? input.clsCategory : service.clsCategory;
    const resultingSpecialtyId = input.specialtyId !== undefined ? input.specialtyId : service.specialtyId;

    if (resultingType === ServiceType.CLS && !resultingClsCategory) {
      throw new ServiceClsCategoryRequiredError();
    }
    if (resultingType === ServiceType.EXAMINATION && resultingClsCategory) {
      throw new ServiceClsCategoryNotAllowedError();
    }
    if (resultingType === ServiceType.EXAMINATION && !resultingSpecialtyId) {
      throw new ServiceSpecialtyMissingError();
    }

    const price = input.price !== undefined ? Money.of(input.price).amount : undefined;

    const updated = await this.serviceRepository.update(input.id, {
      name: input.name,
      specialtyId: input.specialtyId,
      type: input.type,
      clsCategory: input.clsCategory,
      price,
      description: input.description,
      isActive: input.isActive,
      updatedBy: input.updatedBy,
    });

    await this.auditLog.write({
      userId: input.updatedBy,
      action: 'SERVICE_UPDATED',
      module: 'SERVICE',
      targetId: updated.id,
    });

    return this.toDto(updated);
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
