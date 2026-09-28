import { Injectable } from '@nestjs/common';
import { PrintMedicalRecordResponseDto } from '../../dtos/medical-records/print-medical-record-response.dto';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { GetMedicalRecordUseCase } from './get-medical-record.use-case';

export interface PrintMedicalRecordInput {
  patientId: string;
  visitIds?: string[];
  actorId: string;
  actorRole: UserRole;
}

@Injectable()
export class PrintMedicalRecordUseCase {
  constructor(private readonly getMedicalRecordUseCase: GetMedicalRecordUseCase) {}

  async execute(input: PrintMedicalRecordInput): Promise<PrintMedicalRecordResponseDto> {
    const detail = await this.getMedicalRecordUseCase.execute({
      patientId: input.patientId,
      actorId: input.actorId,
      actorRole: input.actorRole,
    });

    // Printable history is every visit regardless of status — restricting
    // this to only COMPLETED visits hid in-progress/waiting/no-show/
    // cancelled visits from the printed record even though they're visible
    // on-screen in "Lịch sử khám" (same fix applied there).
    //
    // Business Rule (Feature 66): printing without selecting any visit
    // defaults to including all visits; selecting one or more visitIds
    // filters the printed record to only those visits.
    const visits =
      input.visitIds && input.visitIds.length > 0
        ? detail.visits.filter((visit) => input.visitIds!.includes(visit.id))
        : detail.visits;

    return {
      patient: detail.patient,
      allergies: detail.allergies,
      visits,
    };
  }
}
