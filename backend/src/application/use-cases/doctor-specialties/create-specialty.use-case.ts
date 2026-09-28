import { Inject, Injectable } from '@nestjs/common';
import { ConflictError } from '../../errors/application-error';
import { SPECIALTY_REPOSITORY, SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { SpecialtyOptionResponseDto } from '../../dtos/doctor-specialties/doctor-specialty-response.dto';

export interface CreateSpecialtyInput {
  name: string;
  description?: string | null;
}

@Injectable()
export class CreateSpecialtyUseCase {
  constructor(@Inject(SPECIALTY_REPOSITORY) private readonly repo: SpecialtyRepository) {}

  async execute(input: CreateSpecialtyInput): Promise<SpecialtyOptionResponseDto> {
    const existing = await this.repo.findByName(input.name.trim());
    if (existing) throw new ConflictError('Tên chuyên khoa');

    const specialty = await this.repo.create({
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
    });

    return { id: specialty.id, name: specialty.name, description: specialty.description };
  }
}
