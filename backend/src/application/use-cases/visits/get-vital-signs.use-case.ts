import { Inject, Injectable } from '@nestjs/common';
import { VitalSignsRecord, VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';

@Injectable()
export class GetVitalSignsUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
  ) {}

  async execute(visitId: string): Promise<VitalSignsRecord | null> {
    return this.visitRepository.getVitalSigns(visitId);
  }
}
