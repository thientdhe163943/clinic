import type { ClsRoomCategory } from './rooms';

export type ServiceType = 'EXAMINATION' | 'CLS';
// Reuses the same enum as Room.clsCategory (LAB/XRAY/ULTRASOUND/ECG) — kept
// as a distinct alias so call sites reading "service category" stay clear.
export type ClsServiceCategory = ClsRoomCategory;

export interface Service {
  id: string;
  serviceCode: string | null;
  name: string;
  specialtyId: string | null;
  specialtyName: string | null;
  type: ServiceType;
  clsCategory: ClsServiceCategory | null;
  price: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceListResponse {
  items: Service[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateServiceRequest {
  name: string;
  specialtyId?: string;
  type?: ServiceType;
  clsCategory?: ClsServiceCategory;
  price: number;
  description?: string;
}

export interface UpdateServiceRequest {
  name?: string;
  specialtyId?: string | null;
  type?: ServiceType;
  clsCategory?: ClsServiceCategory;
  price?: number;
  description?: string;
  isActive?: boolean;
}
