import { Inject, Injectable } from '@nestjs/common';
import { CLS_ORDER_REPOSITORY, ClsOrderRepository } from '../../../domain/repositories/cls-order.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { ROOM_REPOSITORY, RoomRepository } from '../../../domain/repositories/room.repository';
import { VISIT_REPOSITORY, VisitRepository } from '../../../domain/repositories/visit.repository';
import { PdfService } from '../../../infrastructure/services/pdf.service';

@Injectable()
export class PrintAllClsOrdersUseCase {
  constructor(
    @Inject(CLS_ORDER_REPOSITORY) private readonly clsOrderRepository: ClsOrderRepository,
    @Inject(VISIT_REPOSITORY) private readonly visitRepository: VisitRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(ROOM_REPOSITORY) private readonly roomRepository: RoomRepository,
    private readonly pdfService: PdfService,
  ) {}

  async execute(visitId: string, diagnosis?: string): Promise<Buffer | null> {
    const [items, visit] = await Promise.all([
      this.clsOrderRepository.findByVisitId(visitId),
      this.visitRepository.findById(visitId),
    ]);

    if (items.length === 0) return null;

    const [patient, examiningRoom] = await Promise.all([
      visit ? this.patientRepository.findById(visit.patientId) : Promise.resolve(null),
      visit ? this.roomRepository.findById(visit.roomId) : Promise.resolve(null),
    ]);

    const first = items[0];

    return this.pdfService.generateCombinedClsOrderPdf({
      patientName: first.patientName,
      patientCode: first.patientCode,
      dateOfBirth: first.dateOfBirth,
      gender: first.gender,
      address: patient?.address ?? null,
      doctorName: first.doctorName,
      examiningRoomName: examiningRoom?.name ?? null,
      examinationDate: first.appointmentTime,
      diagnosis: diagnosis ?? null,
      orders: items.map((item) => ({
        clsRoomName: item.clsRoomName,
        serviceName: item.serviceName,
        unitPrice: item.servicePrice,
        note: item.order.note,
      })),
    });
  }
}
