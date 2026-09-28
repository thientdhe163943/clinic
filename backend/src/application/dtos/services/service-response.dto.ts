import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { ServiceType } from '../../../domain/enums/service-type.enum';
import { PaginationMeta } from '../pagination.dto';

export interface ServiceResponseDto {
  id: string;
  serviceCode: string | null;
  name: string;
  specialtyId: string | null;
  specialtyName: string | null;
  type: ServiceType;
  clsCategory: ClsRoomCategory | null;
  price: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponseDto {
  items: ServiceResponseDto[];
  meta: PaginationMeta;
}
