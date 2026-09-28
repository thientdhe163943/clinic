import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError, SupplierInUseError } from '../../errors/application-error';
import { SUPPLIER_REPOSITORY, SupplierRepository } from '../../../domain/repositories/supplier.repository';

export interface DeleteSupplierInput {
  id: string;
  deletedBy: string;
}

@Injectable()
export class DeleteSupplierUseCase {
  constructor(@Inject(SUPPLIER_REPOSITORY) private readonly supplierRepository: SupplierRepository) {}

  async execute(input: DeleteSupplierInput): Promise<void> {
    const supplier = await this.supplierRepository.findById(input.id);
    if (!supplier) throw new ResourceNotFoundError('Supplier', { id: input.id });

    // Feature 76: "Không xóa nhà cung cấp còn gắn với lô vật tư đang hoạt
    // động" — SupplyImport has no active/inactive state of its own, so any
    // existing import batch referencing this supplier is treated as in-use.
    const inUse = await this.supplierRepository.isInUse(input.id);
    if (inUse) throw new SupplierInUseError();

    await this.supplierRepository.softDelete(input.id, input.deletedBy);
  }
}
