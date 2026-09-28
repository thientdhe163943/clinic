import { Inject, Injectable } from '@nestjs/common';
import { ConflictError, ResourceNotFoundError } from '../../errors/application-error';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { SpecialtyOptionResponseDto } from '../../dtos/doctor-specialties/doctor-specialty-response.dto';

export interface UpdateSpecialtyInput {
  id: string;
  name?: string;
  description?: string | null;
}

@Injectable()
export class UpdateSpecialtyUseCase {
  constructor(@Inject(SPECIALTY_REPOSITORY) private readonly repo: SpecialtyRepository) {}

  async execute(input: UpdateSpecialtyInput): Promise<SpecialtyOptionResponseDto> {
    const existing = await this.repo.findById(input.id);
    if (!existing) throw new ResourceNotFoundError('Chuyên khoa', { id: input.id });

    if (input.name !== undefined && input.name.trim() !== existing.name) {
      const nameConflict = await this.repo.findByName(input.name.trim());
      if (nameConflict) throw new ConflictError('Tên chuyên khoa');
    }

    const updated = await this.repo.update(input.id, {
      name: input.name?.trim(),
      description: input.description?.trim() ?? input.description,
    });

    return { id: updated.id, name: updated.name, description: updated.description };
  }
}
