import { Inject, Injectable } from '@nestjs/common';
import { SummarizeExamResultResponseDto } from '../../dtos/ai/summarize-exam-result.dto';
import { ExaminationResultNotFoundError, ResourceNotFoundError } from '../../errors/application-error';
import { AI_PROVIDER_PORT, AiProviderPort } from '../../ports/ai-provider.port';
import {
  MEDICAL_RECORD_REPOSITORY,
  MedicalRecordRepository,
} from '../../../domain/repositories/medical-record.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';

export interface SummarizeExamResultInput {
  userId: string;
  visitId: string;
}

const DISCLAIMER = 'Bản tóm tắt do AI diễn giải, không thay thế lời giải thích trực tiếp từ bác sĩ.';

@Injectable()
export class SummarizeExamResultUseCase {
  constructor(
    @Inject(MEDICAL_RECORD_REPOSITORY) private readonly medicalRecordRepository: MedicalRecordRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(AI_PROVIDER_PORT) private readonly aiProvider: AiProviderPort,
  ) {}

  // Feature 85 business rule: "Chỉ áp dụng với kết quả khám của chính bệnh
  // nhân đó" — ownership is enforced structurally, not by comparing ids: the
  // visit is only ever looked up inside the caller's OWN medical record, so
  // a visitId belonging to another patient simply won't be found.
  async execute(input: SummarizeExamResultInput): Promise<SummarizeExamResultResponseDto> {
    const patient = await this.patientRepository.findByUserId(input.userId);
    if (!patient) throw new ResourceNotFoundError('Patient');

    const detail = await this.medicalRecordRepository.findDetail(patient.id);
    if (!detail) throw new ResourceNotFoundError('Patient');

    const visit = detail.visits.find((v) => v.id === input.visitId);
    if (!visit || !visit.diagnosis) throw new ExaminationResultNotFoundError();

    const prescriptionLines = visit.prescriptions.length
      ? visit.prescriptions
          .map((p) => `- ${p.medicineName}: ${p.dosage}, ${p.frequency}, ${p.durationDays} ngày${p.instruction ? ` (${p.instruction})` : ''}`)
          .join('\n')
      : '(không có thuốc được kê)';

    const factsBlock = `Chẩn đoán: ${visit.diagnosis}
Ghi chú lâm sàng: ${visit.clinicalNote ?? '(không có)'}
Kết quả điều trị: ${visit.treatmentResult ?? '(không có)'}
Thuốc được kê:
${prescriptionLines}
Ngày tái khám: ${visit.followUpDate ? visit.followUpDate.toISOString().slice(0, 10) : '(không có)'}`;

    const summary = await this.aiProvider.chat([
      {
        role: 'system',
        content:
          'Bạn là trợ lý y tế, diễn giải kết quả khám bệnh từ thuật ngữ y khoa sang ngôn ngữ thông thường, dễ hiểu cho ' +
          'bệnh nhân không có chuyên môn y khoa. Trình bày ngắn gọn theo 3 phần: "Chẩn đoán của bạn là gì", "Thuốc được ' +
          'kê và mục đích dùng" (nếu có), "Hướng điều trị/tái khám tiếp theo". Không thêm chẩn đoán hay thuốc nào ngoài ' +
          'dữ liệu được cung cấp, không suy diễn thêm thông tin y khoa. Giọng văn thân thiện, trấn an, tiếng Việt, không ' +
          'dùng markdown phức tạp.',
      },
      { role: 'user', content: factsBlock },
    ]);

    return { visitId: input.visitId, summary: summary.trim(), disclaimer: DISCLAIMER };
  }
}
