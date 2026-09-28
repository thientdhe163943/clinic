import { ClsRoomCategory } from '../enums/cls-room-category.enum';
import { ServiceType } from '../enums/service-type.enum';

export class Service {
  constructor(
    public readonly id: string,
    public readonly serviceCode: string | null,
    public readonly name: string,
    public readonly specialtyId: string | null,
    public readonly type: ServiceType,
    public readonly clsCategory: ClsRoomCategory | null,
    public readonly price: number,
    public readonly description: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}
}
