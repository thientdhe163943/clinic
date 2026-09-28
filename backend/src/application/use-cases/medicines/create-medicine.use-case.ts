import { Inject, Injectable } from '@nestjs/common';
import { MedicineNameExistsError } from '../../errors/application-error';
import { MedicineResponseDto } from '../../dtos/medicines/medicine-response.dto';
import { Medicine } from '../../../domain/entities/medicine.entity';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';
import { Money } from '../../../domain/value-objects/money.vo';
import { MeasurementUnit } from '../../../domain/enums/measurement-unit.enum';

export interface CreateMedicineInput {
  name: string;
  activeIngredient: string;
  dosageForm: string;
  unit: MeasurementUnit;
  price: number;
  description?: string;
  contraindications?: string;
  createdBy: string;
}

@Injectable()
export class CreateMedicineUseCase {
  constructor(@Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository) {}

  async execute(input: CreateMedicineInput): Promise<MedicineResponseDto> {
    const price = Money.of(input.price);

    const existing = await this.medicineRepository.findByName(input.name);
    if (existing) throw new MedicineNameExistsError();

    const medicine = await this.medicineRepository.create({
      name: input.name,
      activeIngredient: input.activeIngredient,
      dosageForm: input.dosageForm,
      unit: input.unit,
      price: price.amount,
      description: input.description ?? null,
      contraindications: input.contraindications ?? null,
      createdBy: input.createdBy,
    });

    return this.toDto(medicine);
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
