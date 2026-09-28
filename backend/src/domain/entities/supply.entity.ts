import { MeasurementUnit } from '../enums/measurement-unit.enum';

export class Supply {
  constructor(
    public readonly id: string,
    public readonly categoryId: string,
    public readonly name: string,
    public readonly unit: MeasurementUnit,
    public readonly currentStock: number,
    public readonly minStockLevel: number,
    public readonly description: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly createdBy: string,
    public readonly updatedBy: string | null,
  ) {}
}
