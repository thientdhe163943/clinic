export interface PublicServiceListItem {
  id: string;
  serviceCode: string | null;
  name: string;
  specialtyId: string | null;
  specialtyName: string | null;
  price: number;
  description: string | null;
}

export interface ListPublicServicesQuery {
  search?: string;
  specialtyId?: string;
}
