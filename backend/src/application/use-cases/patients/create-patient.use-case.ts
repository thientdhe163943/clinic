// ============================================================================
// CreatePatientUseCase — "Lễ tân đăng ký hồ sơ bệnh nhân mới" (bệnh nhân đến
// khám trực tiếp tại quầy, chưa từng có tài khoản trong hệ thống — gọi là
// "walk-in")
// ----------------------------------------------------------------------------
// Use case này làm CÙNG LÚC 3 việc cho 1 bệnh nhân mới:
//   1. Kiểm tra thông tin không bị trùng với ai khác (email, SĐT, CCCD/CMND).
//   2. Tạo TÀI KHOẢN ĐĂNG NHẬP cho bệnh nhân (để họ có thể tự đăng nhập vào
//      hệ thống xem lịch hẹn, kết quả khám... sau này) — dùng mật khẩu mặc
//      định chung của hệ thống, và bắt buộc bệnh nhân phải đổi mật khẩu
//      trong lần đăng nhập đầu tiên.
//   3. Tạo HỒ SƠ BỆNH NHÂN (thông tin cá nhân: họ tên, ngày sinh, địa chỉ...)
//      và một "bệnh án" (medical record) rỗng để sau này bác sĩ ghi vào.
// ============================================================================
import { Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AUDIT_LOG_PORT, AuditLogPort } from '../../ports/audit-log.port';
import { CreatePatientRequestDto } from '../../dtos/patients/create-patient.dto';
import { PatientResponseDto, toPatientResponse } from '../../dtos/patients/patient-response.dto';
import { ConflictError } from '../../errors/application-error';
import { PatientCode } from '../../../domain/value-objects/patient-code.vo';
import { DEFAULT_PATIENT_PASSWORD } from '../../../domain/value-objects/password-policy.vo';
import { UserRole } from '../../../domain/enums/user-role.enum';
import {
  MEDICAL_RECORD_REPOSITORY,
  MedicalRecordRepository,
} from '../../../domain/repositories/medical-record.repository';
import { PATIENT_REPOSITORY, PatientRepository } from '../../../domain/repositories/patient.repository';
import { USER_REPOSITORY, UserRepository } from '../../../domain/repositories/user.repository';

const PATIENT_CODE_GENERATION_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 10;

export interface CreatePatientInput extends CreatePatientRequestDto {
  actorId: string;
}

@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly patientRepository: PatientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepository: UserRepository,
    @Inject(MEDICAL_RECORD_REPOSITORY) private readonly medicalRecordRepository: MedicalRecordRepository,
    @Inject(AUDIT_LOG_PORT) private readonly auditLog: AuditLogPort,
  ) {}

  // input: dữ liệu Lễ tân nhập trên form đăng ký (họ tên, ngày sinh, SĐT,
  // CCCD/CMND, email — tùy chọn...) + actorId (Lễ tân nào đang thực hiện).
  async execute(input: CreatePatientInput): Promise<PatientResponseDto> {
    // Email là tùy chọn (không bắt buộc) — nếu người dùng không nhập thì để
    // trống (null) thay vì chuỗi rỗng "".
    const email = input.email?.trim() || null;

    // --- Bước 1: Kiểm tra trùng lặp ở bảng "patients" (hồ sơ bệnh nhân) ---
    // Nếu có nhập email, kiểm tra đã có bệnh nhân nào dùng email này chưa.
    if (email) {
      const existingEmail = await this.patientRepository.findByEmail(email);
      if (existingEmail) throw new ConflictError('Email', { field: 'email' });
    }

    // CCCD/CMND là bắt buộc — kiểm tra đã có bệnh nhân nào dùng số này chưa.
    const existingIdCard = await this.patientRepository.findByIdCard(input.idCard);
    if (existingIdCard) throw new ConflictError('CCCD/CMND', { field: 'idCard' });

    // Business Rule (changed 2026-07-19): every walk-in patient the
    // Receptionist registers now automatically gets a login too — no more
    // opt-in checkbox/typed password. The account starts with a fixed
    // system default password and mustChangePassword: true, so the patient
    // is forced to set their own on first login rather than the shared
    // default ever being a standing credential. Email is optional
    // (2026-08-07) — phone/idCard (both mandatory) already work as login
    // identifiers on their own, see LoginUseCase.
    // --- Bước 2: Kiểm tra trùng lặp tiếp ở bảng "users" (tài khoản đăng
    // nhập) — vì sắp tạo thêm 1 tài khoản đăng nhập mới cho bệnh nhân này,
    // nên phải chắc chắn email/SĐT/CCCD chưa được ai (kể cả nhân viên khác)
    // dùng làm tài khoản trước đó. ---
    if (email) {
      const existingUserByEmail = await this.userRepository.findByEmail(email);
      if (existingUserByEmail) throw new ConflictError('Email', { field: 'email' });
    }

    const existingUserByPhone = await this.userRepository.findByPhone(input.phone);
    if (existingUserByPhone) throw new ConflictError('Số điện thoại', { field: 'phone' });

    // idCard now also lands on users.id_card (unique), not just
    // patients.id_card checked above — a staff member sharing the same real
    // CCCD (e.g. also a patient here) would otherwise hit an unhandled
    // unique-constraint error instead of a clean ConflictError.
    const existingUserByIdCard = await this.userRepository.findByIdCard(input.idCard);
    if (existingUserByIdCard) throw new ConflictError('CCCD/CMND', { field: 'idCard' });

    // --- Bước 3: Tạo tài khoản đăng nhập cho bệnh nhân ---
    // "Băm" (hash) mật khẩu mặc định trước khi lưu — KHÔNG BAO GIỜ lưu mật
    // khẩu dạng chữ thường (plain text) vào database, đây là nguyên tắc bảo
    // mật cơ bản.
    const passwordHash = await bcrypt.hash(DEFAULT_PATIENT_PASSWORD, BCRYPT_ROUNDS);
    const newUser = await this.userRepository.create({
      fullName: input.fullName,
      email,
      phone: input.phone,
      passwordHash,
      role: UserRole.PATIENT,
      // mustChangePassword=true: lần đăng nhập đầu tiên, hệ thống sẽ BẮT
      // BUỘC bệnh nhân đổi sang mật khẩu riêng, không cho dùng mãi mật khẩu
      // mặc định chung (tránh rủi ro bảo mật).
      mustChangePassword: true,
      idCard: input.idCard,
    });
    const newUserId = newUser.id;

    // --- Bước 4: Tạo hồ sơ bệnh nhân, kèm CƠ CHẾ THỬ LẠI khi trùng mã ---
    // Mỗi bệnh nhân có 1 "mã bệnh nhân" (patientCode, ví dụ BN202608050001)
    // được sinh tự động. Về mặt lý thuyết mã này rất khó trùng, nhưng nếu 2
    // người đăng ký gần như CÙNG LÚC (2 lễ tân ở 2 quầy khác nhau), vẫn có
    // khả năng (rất nhỏ) sinh ra cùng 1 mã. Do đó code thử lại tối đa 5 lần:
    // nếu database báo lỗi trùng mã, sinh mã mới và thử lại; nếu đến lần
    // thử cuối cùng (lần 5) vẫn lỗi thì mới thật sự báo lỗi ra ngoài.
    let createdPatient: Awaited<ReturnType<PatientRepository['create']>> | null = null;

    for (let attempt = 0; attempt < PATIENT_CODE_GENERATION_ATTEMPTS; attempt += 1) {
      try {
        createdPatient = await this.patientRepository.create({
          patientCode: PatientCode.generate().value,
          fullName: input.fullName,
          email,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          phone: input.phone,
          idCard: input.idCard,
          address: input.address,
          note: input.note,
          notificationConsent: input.notificationConsent,
          userId: newUserId,
          createdBy: input.actorId,
        });
        break; // Tạo thành công -> thoát vòng lặp ngay, không thử thêm.
      } catch (error) {
        const isLastAttempt = attempt === PATIENT_CODE_GENERATION_ATTEMPTS - 1;
        if (isLastAttempt) throw error; // Hết 5 lần thử mà vẫn lỗi -> chịu thua, báo lỗi thật.
      }
    }

    // Trường hợp cực hiếm: vòng lặp trên chạy hết mà không throw lỗi nhưng
    // cũng không tạo được bệnh nhân — chặn lại cho chắc, tránh crash ở bước
    // sau khi cố dùng createdPatient=null.
    if (!createdPatient) throw new ConflictError('Mã bệnh nhân');

    // --- Bước 5: Tạo sẵn 1 "bệnh án" rỗng cho bệnh nhân mới ---
    // Để sau này khi bác sĩ khám, chỉ cần "cập nhật" (update) bệnh án có sẵn
    // này thay vì phải kiểm tra "có bệnh án chưa, nếu chưa thì tạo mới".
    await this.medicalRecordRepository.upsertByPatientId({
      patientId: createdPatient.id,
      updatedBy: input.actorId,
    });

    // --- Bước 6: Ghi lại "nhật ký thao tác" (audit log) ---
    // Lưu vết: ai (userId) đã làm gì (action=CREATE) với đối tượng nào
    // (module=PATIENT, targetId) — phục vụ tra soát/kiểm tra sau này khi cần.
    await this.auditLog.write({
      userId: input.actorId,
      action: 'CREATE',
      module: 'PATIENT',
      targetId: createdPatient.id,
      detail: { patientCode: createdPatient.patientCode },
    });

    return toPatientResponse(createdPatient);
  }
}
