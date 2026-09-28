export interface PublicServiceListItemDto {
  id: string;
  serviceCode: string | null;
  name: string;
  specialtyId: string | null;
  specialtyName: string | null;
  price: number;
  description: string | null;
}
