import { Inject, Injectable } from '@nestjs/common';
import { MedicineInUseError, ResourceNotFoundError } from '../../errors/application-error';
import { MEDICINE_REPOSITORY, MedicineRepository } from '../../../domain/repositories/medicine.repository';

export interface DeleteMedicineInput {
  id: string;
  deletedBy: string;
}

@Injectable()
export class DeleteMedicineUseCase {
  constructor(@Inject(MEDICINE_REPOSITORY) private readonly medicineRepository: MedicineRepository) {}

  async execute(input: DeleteMedicineInput): Promise<void> {
    const medicine = await this.medicineRepository.findById(input.id);
    if (!medicine) throw new ResourceNotFoundError('Medicine', { id: input.id });

    // Per spec Feature #72: "Không xóa thuốc đang có trong đơn thuốc đang
    // hoạt động". This schema has no active/inactive state on Prescription
    // itself (no cancel/void flag — see prescription.entity.ts), so any
    // existing PrescriptionItem row referencing this medicine is treated as
    // "in use" and blocks the delete. This matches the already-seeded
    // MSG_ERR_0052 text ("đang được sử dụng trong đơn thuốc của bệnh nhân"),
    // which likewise doesn't distinguish an "active" vs "past" prescription.
    const inUse = await this.medicineRepository.isInUse(input.id);
    if (inUse) throw new MedicineInUseError();

    await this.medicineRepository.softDelete(input.id, input.deletedBy);
  }
}
