import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenActionError, ResourceNotFoundError } from '../../errors/application-error';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';

@Injectable()
export class DeleteSpecialtyUseCase {
  constructor(@Inject(SPECIALTY_REPOSITORY) private readonly repo: SpecialtyRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new ResourceNotFoundError('Chuyên khoa', { id });

    const inUse = await this.repo.isInUse(id);
    if (inUse) throw new ForbiddenActionError();

    await this.repo.delete(id);
  }
}
