// ============================================================================
// UpdateDoctorSpecialtyProfileUseCase — "Admin sửa trực tiếp hồ sơ chuyên
// khoa của 1 bác sĩ bất kỳ"
// ----------------------------------------------------------------------------
// Khác với UpdateMyDoctorSpecialtyUseCase (bác sĩ tự sửa, phải chờ Admin
// duyệt), use case NÀY do chính ADMIN thực hiện nên được phép ghi đè NGAY
// LẬP TỨC vào hồ sơ chính thức, tự động đánh dấu "APPROVED" (đã duyệt) —
// không cần qua bước chờ duyệt vì chính Admin là người xác nhận thông tin.
// Đồng thời, nếu bác sĩ đó đang có 1 yêu cầu tự cập nhật ở trạng thái "chờ
// duyệt", yêu cầu đó sẽ bị xóa bỏ (coi như đã được Admin xử lý xong bằng
// cách sửa trực tiếp luôn).
// ============================================================================
import { Injectable } from '@nestjs/common';
import { DoctorProfileApprovalStatus, Prisma } from '@prisma/client';
import { UpdateDoctorSpecialtyDto } from '../../dtos/doctor-specialties/update-doctor-specialty.dto';
import { DoctorSpecialtyProfileResponseDto } from '../../dtos/doctor-specialties/doctor-specialty-response.dto';
import { ApplicationError, ResourceNotFoundError } from '../../errors/application-error';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { MSG } from '../../../domain/value-objects/message-code.vo';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

const doctorProfileInclude = {
  user: true,
  specialty: true,
  certificationFiles: true,
} satisfies Prisma.DoctorProfileInclude;

type DoctorProfileWithRelations = Prisma.DoctorProfileGetPayload<{
  include: typeof doctorProfileInclude;
}>;

@Injectable()
export class UpdateDoctorSpecialtyProfileUseCase {
  constructor(private readonly prisma: PrismaService) {}

  // doctorUserId: mã bác sĩ mà Admin muốn sửa hồ sơ.
  // updatedBy: mã tài khoản Admin đang thực hiện thao tác này (để ghi log ai
  // đã duyệt/sửa).
  // input: nội dung mới (chuyên khoa, bằng cấp...) Admin nhập vào form.
  async execute(
    doctorUserId: string,
    updatedBy: string,
    input: UpdateDoctorSpecialtyDto,
  ): Promise<DoctorSpecialtyProfileResponseDto> {
    // Kiểm tra song song: bác sĩ này có tồn tại không? Chuyên khoa Admin chọn
    // có thật sự nằm trong danh mục của phòng khám không?
    const [doctor, specialty] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: doctorUserId,
          role: UserRole.DOCTOR,
          deletedAt: null,
        },
      }),
      this.prisma.specialty.findUnique({
        where: { id: input.specialtyId },
      }),
    ]);

    if (!doctor) throw new ResourceNotFoundError('Doctor');
    if (!specialty) throw new ApplicationError(MSG.ERR_0006, 400);

    // "$transaction" nghĩa là gộp nhiều thao tác ghi database thành 1 khối
    // — hoặc TẤT CẢ đều thành công, hoặc nếu có lỗi giữa chừng thì TOÀN BỘ
    // sẽ tự động hủy bỏ (rollback), tránh để dữ liệu bị ghi nửa chừng, dở dang
    // (ví dụ: cập nhật hồ sơ xong nhưng lưu file chứng chỉ bị lỗi thì không
    // được để hồ sơ đã đổi mà file chứng chỉ thì không khớp).
    const row = await this.prisma.$transaction(async (tx) => {
      // Ghi đè trực tiếp vào hồ sơ chính thức (doctorProfile), đánh dấu ngay
      // là "APPROVED" (đã duyệt) kèm thông tin ai duyệt (approvedBy) và
      // duyệt lúc nào (approvedAt) — không giống bác sĩ tự sửa (phải chờ).
      const profile = await tx.doctorProfile.upsert({
        where: { userId: doctorUserId },
        create: {
          userId: doctorUserId,
          specialtyId: input.specialtyId,
          subspecialty: input.subspecialty?.trim() || null,
          degree: input.degree?.trim() || null,
          certification: input.certification?.trim() || null,
          yearsExperience: input.yearsExperience ?? null,
          biography: input.biography?.trim() || null,
          avatarUrl: input.avatarUrl?.trim() || null,
          approvalStatus: DoctorProfileApprovalStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: updatedBy,
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null,
          updatedBy,
        },
        update: {
          specialtyId: input.specialtyId,
          subspecialty: input.subspecialty?.trim() || null,
          degree: input.degree?.trim() || null,
          certification: input.certification?.trim() || null,
          yearsExperience: input.yearsExperience ?? null,
          biography: input.biography?.trim() || null,
          avatarUrl: input.avatarUrl?.trim() || null,
          approvalStatus: DoctorProfileApprovalStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: updatedBy,
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null,
          updatedBy,
        },
      });

      // Vì Admin đã sửa trực tiếp rồi, nên xóa luôn mọi yêu cầu "chờ duyệt"
      // cũ của bác sĩ này (nếu có) — không còn gì để chờ duyệt nữa.
      await tx.doctorProfilePendingUpdate.deleteMany({ where: { doctorProfileId: profile.id } });

      // Nếu Admin có gửi kèm danh sách ảnh/file chứng chỉ mới, thì XÓA HẾT
      // file cũ và thay bằng danh sách mới hoàn toàn (không cộng dồn).
      if (input.certificationFileUrls) {
        await tx.doctorCertificationFile.deleteMany({ where: { doctorProfileId: profile.id } });
        const files = input.certificationFileUrls
          .map((url) => url.trim())
          .filter(Boolean)
          .map((url) => ({
            doctorProfileId: profile.id,
            fileUrl: url,
            originalName: this.getFileNameFromUrl(url),
            uploadedBy: updatedBy,
          }));
        if (files.length) await tx.doctorCertificationFile.createMany({ data: files });
      }

      // Đọc lại hồ sơ vừa lưu (kèm đầy đủ chuyên khoa + file chứng chỉ) để
      // trả về cho Frontend hiển thị.
      return tx.doctorProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: doctorProfileInclude,
      });
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
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private getFileNameFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url);
      const fileName = parsed.pathname.split('/').filter(Boolean).pop();
      return fileName ? decodeURIComponent(fileName).slice(0, 255) : null;
    } catch {
      return null;
    }
  }
}
