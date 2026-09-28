import { Inject, Injectable } from '@nestjs/common';
import { MedicineNameExistsError, ResourceNotFoundError } from '../../errors/application-error';
import { MedicineResponseDto } from '../../dtos/medicines/medicine-response.dto';
import { Medicine } from '../../../domain/entities/medicine.entity';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';
import { Money } from '../../../domain/value-objects/money.vo';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';

export interface UpdateMedicineInput {
  id: string;
  name?: string;
  activeIngredient?: string;
  dosageForm?: string;
  unit?: MeasurementUnit;
  price?: number;
  description?: string;
  contraindications?: string;
  isActive?: boolean;
  updatedBy: string;
}

@Injectable()
export class UpdateMedicineUseCase {
  constructor(@Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository) {}

  async execute(input: UpdateMedicineInput): Promise<MedicineResponseDto> {
    const medicine = await this.medicineRepository.findById(input.id);
    if (!medicine) throw new ResourceNotFoundError('Medicine', { id: input.id });

    if (input.name !== undefined && input.name !== medicine.name) {
      const existing = await this.medicineRepository.findByName(input.name);
      if (existing) throw new MedicineNameExistsError();
    }

    const price = input.price !== undefined ? Money.of(input.price).amount : undefined;

    const updated = await this.medicineRepository.update(input.id, {
      name: input.name,
      activeIngredient: input.activeIngredient,
      dosageForm: input.dosageForm,
      unit: input.unit,
      price,
      description: input.description,
      contraindications: input.contraindications,
      isActive: input.isActive,
      updatedBy: input.updatedBy,
    });

    return this.toDto(updated);
  }

  private toDto(medicine: Medicine): MedicineResponseDto {
    return {
      id: medicine.id,
      name: medicine.name,
      activeIngredient: medicine.activeIngredient,
      dosageForm: medicine.dosageForm,
      unit: medicine.unit,
      price: medicine.price,
      description: medicine.description,
      contraindications: medicine.contraindications,
      isActive: medicine.isActive,
      createdAt: medicine.createdAt.toISOString(),
      updatedAt: medicine.updatedAt.toISOString(),
    };
  }
}
