// ============================================================================
// UpdateMedicalRecordUseCase — "Bác sĩ ghi/cập nhật bệnh án cho bệnh nhân"
// ----------------------------------------------------------------------------
// Đây là nơi bác sĩ nhập tiền sử bệnh, ghi chú lâm sàng, chẩn đoán, hướng
// điều trị, danh sách dị ứng của bệnh nhân sau khi khám. CHỈ BÁC SĨ mới được
// làm việc này, và chỉ với bệnh nhân mà bác sĩ đó ĐANG khám (có 1 lượt khám
// đang diễn ra) — không được sửa bệnh án tùy tiện của bất kỳ ai.
// ============================================================================
import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { UpdateMedicalRecordRequestDto } from '../../dtos/medical-records/update-medical-record.dto';
import { MedicalRecordDetailDto, toMedicalRecordDetailDto } from '../../dtos/medical-records/medical-record-response.dto';
import { ApplicationError, ResourceNotFoundError } from '../../errors/application-error';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import {
  MEDICAL_RECORD_REPOSITORY,
  MedicalRecordRepository,
} from '../../../domain/repositories/medical-record.repository';

export interface UpdateMedicalRecordInput extends UpdateMedicalRecordRequestDto {
  patientId: string;
  actorId: string;
  actorRole: UserRole;
}

@Injectable()
export class UpdateMedicalRecordUseCase {
  constructor(
    @Inject(MEDICAL_RECORD_REPOSITORY) private readonly medicalRecordRepository: MedicalRecordRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  // input.patientId: bệnh nhân đang được ghi bệnh án.
  // input.medicalHistory / clinicalNote / diagnosisSummary / treatmentSummary
  // / followUpNote / allergies: nội dung bác sĩ nhập trên form khám bệnh.
  // input.actorId / actorRole: ai đang thao tác (để kiểm tra quyền).
  async execute(input: UpdateMedicalRecordInput): Promise<MedicalRecordDetailDto> {
    // Kiểm tra quyền — LỚP 1: phải là tài khoản BÁC SĨ mới được đi tiếp.
    if (input.actorRole !== UserRole.DOCTOR) throw new ApplicationError(MSG.ERR_0008, 403);

    // Kiểm tra quyền — LỚP 2: dù là bác sĩ, cũng chỉ được sửa bệnh án của
    // bệnh nhân mà mình ĐANG CÓ 1 lượt khám thật sự diễn ra (tham số `true`
    // truyền vào nghĩa là "chỉ tính lượt khám đang mở/chưa hoàn tất") — tránh
    // trường hợp 1 bác sĩ vô tình/cố ý sửa bệnh án của bệnh nhân đang do bác
    // sĩ khác khám.
    const canUpdate = await this.medicalRecordRepository.hasDoctorVisit(input.patientId, input.actorId, true);
    if (!canUpdate) throw new ApplicationError(MSG.ERR_0008, 403);

    // Bước 1: Lưu các thông tin văn bản của bệnh án (tiền sử, ghi chú lâm
    // sàng, chẩn đoán, hướng điều trị, dặn dò tái khám). "upsert" nghĩa là:
    // nếu bệnh nhân đã có bệnh án rồi thì CẬP NHẬT, nếu chưa có (hiếm khi xảy
    // ra vì CreatePatientUseCase đã tạo sẵn 1 bệnh án rỗng) thì TẠO MỚI.
    await this.medicalRecordRepository.upsertByPatientId({
      patientId: input.patientId,
      medicalHistory: input.medicalHistory,
      clinicalNote: input.clinicalNote,
      diagnosisSummary: input.diagnosisSummary,
      treatmentSummary: input.treatmentSummary,
      followUpNote: input.followUpNote,
      updatedBy: input.actorId,
    });

    // Bước 2: Nếu bác sĩ CÓ gửi kèm danh sách dị ứng (allergies), thì THAY
    // THẾ TOÀN BỘ danh sách dị ứng cũ bằng danh sách mới này (không cộng
    // dồn). Nếu bác sĩ không gửi trường này (undefined) thì giữ nguyên danh
    // sách dị ứng cũ, không đụng tới.
    if (input.allergies) {
      await this.medicalRecordRepository.replaceAllergies({
        patientId: input.patientId,
        allergies: input.allergies,
        createdBy: input.actorId,
      });
    }

    // Bước 3: Ghi "nhật ký thao tác" — lưu vết ai vừa sửa bệnh án của bệnh
    // nhân nào, phục vụ tra soát sau này.
    await this.auditLog.write({
      userId: input.actorId,
      action: 'UPDATE',
      module: 'MEDICAL_RECORD',
      targetId: input.patientId,
    });

    // Bước 4: Đọc lại toàn bộ bệnh án (đã bao gồm những gì vừa sửa) để trả
    // về cho Frontend hiển thị ngay, không cần Frontend phải gọi thêm 1 lần
    // "xem bệnh án" riêng sau khi lưu.
    const detail = await this.medicalRecordRepository.findDetail(input.patientId);
    if (!detail) throw new ResourceNotFoundError('Patient');

    return toMedicalRecordDetailDto(detail);
  }
}
