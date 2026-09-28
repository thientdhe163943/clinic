import { Inject, Injectable } from '@nestjs/common';
import { buildPaginationMeta } from '../../dtos/pagination.dto';
import { ServiceListResponseDto, ServiceResponseDto } from '../../dtos/services/service-response.dto';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { Service } from '../../../domain/entities/service.entity';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { SERVICE_REPOSITORY, ServiceRepository } from '../../../domain/repositories/service.repository';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';

export interface ListServicesInput {
  search?: string;
  type?: ServiceType;
  clsCategory?: ClsRoomCategory;
  page?: number;
  limit?: number;
}

@Injectable()
export class ListServicesUseCase {
  constructor(
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepository: ServiceRepository,
    @Inject(SPECIALTY_REPOSITORY) private readonly specialtyRepository: SpecialtyRepository,
  ) {}

  async execute(input: ListServicesInput): Promise<ServiceListResponseDto> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;

    const { items, total } = await this.serviceRepository.findMany({
      search: input.search,
      type: input.type,
      clsCategory: input.clsCategory,
      page,
      limit,
    });

    const specialtyIds = [...new Set(items.map((item) => item.specialtyId).filter((id): id is string => !!id))];
    const specialties = await this.specialtyRepository.findByIds(specialtyIds);
    const specialtyNameById = new Map(specialties.map((specialty) => [specialty.id, specialty.name]));

    return {
      items: items.map((service) => this.toDto(service, specialtyNameById)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  private toDto(service: Service, specialtyNameById: Map<string, string>): ServiceResponseDto {
    return {
      id: service.id,
      serviceCode: service.serviceCode,
      name: service.name,
      specialtyId: service.specialtyId,
      specialtyName: (service.specialtyId && specialtyNameById.get(service.specialtyId)) ?? null,
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
