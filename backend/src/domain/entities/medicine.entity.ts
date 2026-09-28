import { MeasurementUnit } from '../enums/measurement-unit.enum';

export class Medicine {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly activeIngredient: string,
    public readonly dosageForm: string,
    public readonly unit: MeasurementUnit,
    public readonly price: number | null,
    public readonly contraindications: string | null,
    public readonly description: string | null,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}
}
