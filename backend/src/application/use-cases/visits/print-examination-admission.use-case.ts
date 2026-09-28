import { Inject, Injectable } from '@nestjs/common';
import { VisitNotFoundError, VisitTicketNotPrintableError } from '../../errors/application-error';
import { VisitStatus } from '../../../domain/enums/visit-status.enum';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';
import { PdfService } from '../../../infrastructure/services/pdf.service';

// The admission slip ("Phieu kham benh") is only meaningful while the visit
// is still waiting to be seen — a completed/in-progress visit has moved past
// the check-in moment this slip represents.
const PRINTABLE_STATUSES = [VisitStatus.WAITING, VisitStatus.CALLED, VisitStatus.NO_SHOW];

@Injectable()
export class PrintExaminationAdmissionUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    private readonly pdfService: PdfService,
  ) {}

  async execute(visitId: string, actorId: string): Promise<Buffer> {
    const details = await this.visitRepository.findByIdWithDetails(visitId);
    if (!details) throw new VisitNotFoundError();
    if (!PRINTABLE_STATUSES.includes(details.visit.status)) throw new VisitTicketNotPrintableError();

    const [patient, receptionist] = await Promise.all([
      this.patientRepository.findById(details.visit.patientId),
      this.userRepository.findById(actorId),
    ]);

    return this.pdfService.generateExaminationAdmissionPdf({
      roomName: details.roomName,
      queueNumber: details.visit.queueNumber,
      patientName: details.patientName,
      patientAddress: patient?.address ?? null,
      patientCode: details.patientCode,
      patientDateOfBirth: patient?.dateOfBirth ?? new Date(0),
      checkedInAt: details.checkedInAt ?? new Date(),
      receptionistName: receptionist?.fullName ?? '',
    });
  }
}
