// ============================================================================
// UpdateMyDoctorSpecialtyUseCase — "Bác sĩ tự cập nhật hồ sơ chuyên khoa của
// chính mình" (ví dụ: đổi chuyên khoa, cập nhật bằng cấp, thêm ảnh chứng chỉ...)
// ----------------------------------------------------------------------------
// ĐIỂM QUAN TRỌNG NHẤT của use case này: thông tin bác sĩ gửi lên KHÔNG được
// áp dụng ngay lập tức, mà chỉ được lưu vào một bảng "nháp" riêng
// (doctorProfilePendingUpdate) với trạng thái "PENDING_APPROVAL" (đang chờ
// duyệt). Phải có Admin vào duyệt (xem ApproveDoctorSpecialtyUpdateUseCase)
// thì thông tin mới thật sự được ghi đè lên hồ sơ chính thức. Đây là cơ chế
// kiểm soát chất lượng — tránh việc bác sĩ tự ý khai man bằng cấp/chuyên khoa
// mà không ai kiểm tra.
// ============================================================================
import { Injectable } from '@nestjs/common';
import { DoctorProfileApprovalStatus, Prisma } from '@prisma/client';
import { UpdateDoctorSpecialtyDto } from '../../dtos/doctor-specialties/update-doctor-specialty.dto';
import {
  DoctorSpecialtyProfileResponseDto,
  PendingDoctorSpecialtyUpdateResponseDto,
} from '../../dtos/doctor-specialties/doctor-specialty-response.dto';
import { ApplicationError, ResourceNotFoundError } from '../../errors/application-error';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

const doctorProfileInclude = {
  user: true,
  specialty: true,
  certificationFiles: true,
  pendingUpdate: {
    include: {
      specialty: true,
    },
  },
} satisfies Prisma.DoctorProfileInclude;

type DoctorProfileWithRelations = Prisma.DoctorProfileGetPayload<{
  include: typeof doctorProfileInclude;
}>;

@Injectable()
export class UpdateMyDoctorSpecialtyUseCase {
  constructor(private readonly prisma: PrismaService) {}

  // userId: mã bác sĩ đang đăng nhập (lấy từ token, xem doctor-specialties.controller.ts).
  // input: những thông tin bác sĩ muốn đổi (chuyên khoa, bằng cấp, ảnh chứng chỉ...).
  async execute(userId: string, input: UpdateDoctorSpecialtyDto): Promise<DoctorSpecialtyProfileResponseDto> {
    // Bước 1: Kiểm tra 2 điều kiện cùng lúc (chạy song song cho nhanh):
    //   - Tài khoản gửi request có đúng là 1 bác sĩ đang hoạt động không?
    //   - Chuyên khoa mà bác sĩ chọn (specialtyId) có thật sự tồn tại trong
    //     danh mục chuyên khoa của phòng khám không? (tránh chọn ID bừa bãi)
    const [user, specialty] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: userId,
          role: UserRole.DOCTOR,
          isActive: true,
          deletedAt: null,
        },
      }),
      this.prisma.specialty.findUnique({
        where: { id: input.specialtyId },
      }),
    ]);

    if (!user) throw new ResourceNotFoundError('Doctor');
    if (!specialty) throw new ApplicationError(MSG.ERR_0006, 400);

    // Bước 2: Đảm bảo bác sĩ này đã có "hồ sơ chuyên khoa" (doctorProfile)
    // trong database chưa. Nếu chưa có (lần đầu cập nhật) thì tạo mới với
    // trạng thái "đang chờ duyệt"; nếu đã có rồi thì chỉ cần đánh dấu ai vừa
    // sửa (updatedBy) — thông tin thật sự chưa đổi ở bước này.
    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId },
      create: {
        userId,
        approvalStatus: DoctorProfileApprovalStatus.PENDING_APPROVAL,
        updatedBy: userId,
      },
      update: {
        updatedBy: userId,
      },
    });

    // Bước 3: Đây mới là chỗ LƯU THẬT nội dung bác sĩ vừa nhập — nhưng lưu
    // vào bảng "nháp" doctorProfilePendingUpdate (không lưu vào hồ sơ chính
    // thức), kèm trạng thái PENDING_APPROVAL. Nếu bác sĩ sửa nhiều lần trước
    // khi được duyệt, bản nháp cũ sẽ bị ghi đè bằng bản mới nhất (không tích
    // lũy thành nhiều bản nháp).
    await this.prisma.doctorProfilePendingUpdate.upsert({
      where: { doctorProfileId: profile.id },
      create: {
        doctorProfileId: profile.id,
        specialtyId: input.specialtyId,
        subspecialty: input.subspecialty?.trim() || null,
        degree: input.degree?.trim() || null,
        certification: input.certification?.trim() || null,
        certificationFileUrls: this.serializeCertificationFileUrls(input.certificationFileUrls),
        yearsExperience: input.yearsExperience ?? null,
        biography: input.biography?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
        status: DoctorProfileApprovalStatus.PENDING_APPROVAL,
        submittedBy: userId,
      },
      // Nếu đã có 1 bản nháp cũ (ví dụ trước đó từng bị Admin từ chối), thì
      // lần nộp lại này sẽ RESET các trường liên quan đến việc duyệt trước
      // đó (reviewedBy/reviewedAt/rejectionReason đều đưa về null) — coi như
      // một yêu cầu duyệt hoàn toàn mới, Admin phải xem lại từ đầu.
      update: {
        specialtyId: input.specialtyId,
        subspecialty: input.subspecialty?.trim() || null,
        degree: input.degree?.trim() || null,
        certification: input.certification?.trim() || null,
        certificationFileUrls: this.serializeCertificationFileUrls(input.certificationFileUrls),
        yearsExperience: input.yearsExperience ?? null,
        biography: input.biography?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
        status: DoctorProfileApprovalStatus.PENDING_APPROVAL,
        submittedBy: userId,
        submittedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        rejectionReason: null,
      },
    });

    // Bước 4: Đọc lại toàn bộ hồ sơ (bao gồm cả bản nháp vừa lưu) để trả về
    // cho Frontend hiển thị — nhờ vậy giao diện có thể hiện song song "thông
    // tin hiện tại đang được duyệt" bên cạnh "thông tin cũ đang áp dụng".
    const row = await this.prisma.doctorProfile.findUniqueOrThrow({
      where: { id: profile.id },
      include: doctorProfileInclude,
    });

    return this.toDto(row);
  }

  private toDto(row: DoctorProfileWithRelations): DoctorSpecialtyProfileResponseDto {
    return {
      id: row.id,
      userId: row.userId,
      fullName: DoctorDisplayName.format(row.user.fullName),
      email: row.user.email,
      phone: row.user.phone,
      isActive: row.user.isActive,
      specialtyId: row.specialtyId,
      specialtyName: row.specialty?.name ?? null,
      specialtyDescription: row.specialty?.description ?? null,
      subspecialty: row.subspecialty,
      degree: row.degree,
      certification: row.certification,
      certificationFiles: row.certificationFiles.map((file) => ({
        id: file.id,
        fileUrl: file.fileUrl,
        originalName: file.originalName,
        uploadedAt: file.uploadedAt.toISOString(),
      })),
      yearsExperience: row.yearsExperience,
      biography: row.biography,
      avatarUrl: row.avatarUrl,
      approvalStatus: row.approvalStatus,
      pendingUpdate: row.pendingUpdate ? this.toPendingDto(row.pendingUpdate) : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toPendingDto(
    row: NonNullable<DoctorProfileWithRelations['pendingUpdate']>,
  ): PendingDoctorSpecialtyUpdateResponseDto {
    return {
      id: row.id,
      specialtyId: row.specialtyId,
      specialtyName: row.specialty?.name ?? null,
      subspecialty: row.subspecialty,
      degree: row.degree,
      certification: row.certification,
      certificationFileUrls: this.parseCertificationFileUrls(row.certificationFileUrls),
      yearsExperience: row.yearsExperience,
      biography: row.biography,
      avatarUrl: row.avatarUrl,
      status: row.status,
      submittedAt: row.submittedAt.toISOString(),
      rejectionReason: row.rejectionReason,
    };
  }

  private serializeCertificationFileUrls(value?: string[]): string | null {
    const urls = value?.map((url) => url.trim()).filter(Boolean) ?? [];
    return urls.length ? JSON.stringify(urls) : null;
  }

  private parseCertificationFileUrls(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}
