// ============================================================================
// GetMedicalRecordUseCase — "Xem bệnh án của 1 bệnh nhân"
// ----------------------------------------------------------------------------
// Bệnh án chứa thông tin nhạy cảm (tiền sử bệnh, chẩn đoán, đơn thuốc...) nên
// KHÔNG PHẢI ai đăng nhập cũng được xem — use case này có 2 điểm vào:
//   - execute(): dùng khi Admin/Lễ tân/Bác sĩ xem bệnh án của MỘT bệnh nhân
//     cụ thể (có kiểm tra quyền chặt chẽ, xem hàm ensureCanView bên dưới).
//   - executeMine(): dùng khi chính BỆNH NHÂN đăng nhập vào xem bệnh án của
//     RIÊNG MÌNH (không cần truyền patientId — tự suy ra từ tài khoản đang
//     đăng nhập, nên không thể xem nhầm/xem trộm bệnh án người khác).
// ============================================================================
import { Inject, Injectable } from '@nestjs/common';
import { MedicalRecordDetailDto, toMedicalRecordDetailDto } from '../../dtos/medical-records/medical-record-response.dto';
import { ApplicationError, ResourceNotFoundError } from '../../errors/application-error';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import {
  MEDICAL_RECORD_REPOSITORY,
  MedicalRecordRepository,
} from '../../../domain/repositories/medical-record.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { UserRole } from '../../../domain/enums/user-role.enum';

export interface GetMedicalRecordInput {
  patientId: string;
  actorId: string;
  actorRole: UserRole;
}

@Injectable()
export class GetMedicalRecordUseCase {
  constructor(
    @Inject(MEDICAL_RECORD_REPOSITORY) private readonly medicalRecordRepository: MedicalRecordRepository,
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
  ) {}

  // input.patientId: bệnh nhân muốn xem bệnh án của ai.
  // input.actorId / input.actorRole: ai đang thực hiện thao tác xem, và vai
  // trò của người đó (ADMIN/RECEPTIONIST/DOCTOR/PATIENT) — dùng để kiểm tra
  // quyền ở bước ensureCanView() bên dưới.
  async execute(input: GetMedicalRecordInput): Promise<MedicalRecordDetailDto> {
    // Bước 1: KIỂM TRA QUYỀN trước tiên — nếu không đủ quyền, hàm này sẽ tự
    // ném lỗi (403 - Không có quyền) và dừng lại ngay, không đi tiếp xuống
    // dưới để đọc dữ liệu.
    await this.ensureCanView(input);

    // Bước 2: Đủ quyền rồi mới thật sự đọc bệnh án từ database.
    const detail = await this.medicalRecordRepository.findDetail(input.patientId);
    if (!detail) throw new ResourceNotFoundError('Patient');

    return toMedicalRecordDetailDto(detail);
  }

  // Dùng riêng cho BỆNH NHÂN xem bệnh án CỦA CHÍNH MÌNH (menu "Bệnh án của
  // tôi"). userId ở đây là tài khoản đăng nhập, KHÔNG PHẢI patientId — nên
  // bước đầu tiên phải tra ra patientId tương ứng với tài khoản này trước.
  async executeMine(userId: string): Promise<MedicalRecordDetailDto> {
    const patient = await this.patientRepository.findByUserId(userId);
    if (!patient) throw new ResourceNotFoundError('Patient');

    const detail = await this.medicalRecordRepository.findDetail(patient.id);
    if (!detail) throw new ResourceNotFoundError('Patient');

    return toMedicalRecordDetailDto(detail);
  }

  // "Luật" ai được xem bệnh án của ai — đây là phần LOGIC PHÂN QUYỀN quan
  // trọng nhất của use case này. Áp dụng LẦN LƯỢT từng luật, luật nào khớp
  // trước thì dừng ở đó (return = cho phép xem):
  private async ensureCanView(input: GetMedicalRecordInput): Promise<void> {
    // Luật 1: Admin và Lễ tân được xem bệnh án của BẤT KỲ bệnh nhân nào
    // (phục vụ công việc tiếp đón, quản lý).
    if (input.actorRole === UserRole.ADMIN || input.actorRole === UserRole.RECEPTIONIST) return;

    // Luật 2: Nếu người xem là BỆNH NHÂN, chỉ được xem bệnh án CỦA CHÍNH
    // MÌNH — kiểm tra patientId tương ứng với tài khoản đang đăng nhập có
    // đúng bằng patientId mà họ đang cố xem hay không. Nếu không khớp (cố
    // xem bệnh án người khác) -> từ chối (lỗi 403).
    if (input.actorRole === UserRole.PATIENT) {
      const patient = await this.patientRepository.findByUserId(input.actorId);
      if (patient?.id === input.patientId) return;

      throw new ApplicationError(MSG.ERR_0008, 403);
    }

    // Luật 3 (còn lại là BÁC SĨ): bác sĩ chỉ được xem bệnh án của bệnh nhân
    // mà MÌNH TỪNG KHÁM (có ít nhất 1 lượt khám/visit với bệnh nhân đó) —
    // không được xem tùy tiện bệnh án của bệnh nhân chưa từng khám qua.
    const hasAccess = await this.medicalRecordRepository.hasDoctorVisit(input.patientId, input.actorId);
    if (!hasAccess) throw new ApplicationError(MSG.ERR_0008, 403);
  }
}
