import { ClsRoomCategory } from '../enums/cls-room-category.enum';
import { Service } from '../entities/service.entity';
import { ServiceType } from '../enums/service-type.enum';

export const SERVICE_REPOSITORY = Symbol('SERVICE_REPOSITORY');

export interface ServiceListFilter {
  search?: string;
  type?: ServiceType;
  clsCategory?: ClsRoomCategory;
  page: number;
  limit: number;
}

export interface CreateServiceData {
  serviceCode: string;
  name: string;
  specialtyId?: string | null;
  type?: ServiceType;
  clsCategory?: ClsRoomCategory | null;
  price: number;
  description?: string | null;
  createdBy: string;
}

export interface UpdateServiceData {
  name?: string;
  specialtyId?: string | null;
  type?: ServiceType;
  clsCategory?: ClsRoomCategory | null;
  price?: number;
  description?: string | null;
  isActive?: boolean;
  updatedBy: string;
}

export interface ServiceRepository {
  findById(id: string): Promise<Service | null>;
  findByName(name: string): Promise<Service | null>;
  findByCode(code: string): Promise<Service | null>;
  findMany(filter: ServiceListFilter): Promise<{ items: Service[]; total: number }>;
  count(): Promise<number>;
  create(data: CreateServiceData): Promise<Service>;
  update(id: string, data: UpdateServiceData): Promise<Service>;
  softDelete(id: string, deletedBy: string): Promise<void>;
  /** Returns true if the service is linked to active appointments or unpaid invoices. */
  isInUse(id: string): Promise<boolean>;
}
