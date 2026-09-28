import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError, SupplyHasStockError, SupplyHasTransactionHistoryError } from '../../errors/application-error';
import { SUPPLY_REPOSITORY, SupplyRepository } from '../../../domain/repositories/supply.repository';

export interface DeleteSupplyInput {
  id: string;
  deletedBy: string;
}

@Injectable()
export class DeleteSupplyUseCase {
  constructor(@Inject(SUPPLY_REPOSITORY) private readonly supplyRepository: SupplyRepository) {}

  async execute(input: DeleteSupplyInput): Promise<void> {
    const supply = await this.supplyRepository.findById(input.id);
    if (!supply) throw new ResourceNotFoundError('Supply', { id: input.id });

    // Feature 26 BRs: cannot delete if still has stock, or if it already has
    // transaction history.
    if (supply.currentStock > 0) throw new SupplyHasStockError();

    const hasTransactions = await this.supplyRepository.hasTransactions(input.id);
    if (hasTransactions) throw new SupplyHasTransactionHistoryError();

    await this.supplyRepository.softDelete(input.id, input.deletedBy);
  }
}
