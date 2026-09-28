import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError, SupplyCategoryInUseError } from '../../errors/application-error';
import {
  SUPPLY_CATEGORY_REPOSITORY,
  SupplyCategoryRepository,
} from '../../../domain/repositories/supply-category.repository';

export interface DeleteSupplyCategoryInput {
  id: string;
  deletedBy: string;
}

@Injectable()
export class DeleteSupplyCategoryUseCase {
  constructor(
    @Inject(SUPPLY_CATEGORY_REPOSITORY) private readonly supplyCategoryRepository: SupplyCategoryRepository,
  ) {}

  async execute(input: DeleteSupplyCategoryInput): Promise<void> {
    const category = await this.supplyCategoryRepository.findById(input.id);
    if (!category) throw new ResourceNotFoundError('SupplyCategory', { id: input.id });

    // Feature 80 BR: "Không xóa danh mục còn chứa vật tư."
    const hasSupplies = await this.supplyCategoryRepository.hasSupplies(input.id);
    if (hasSupplies) throw new SupplyCategoryInUseError();

    await this.supplyCategoryRepository.softDelete(input.id, input.deletedBy);
  }
}
