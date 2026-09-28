// ============================================================================
// ListDoctorSpecialtyProfilesUseCase — "Admin xem danh sách toàn bộ bác sĩ
// kèm hồ sơ chuyên khoa" (trang quản lý bác sĩ của Admin)
// ----------------------------------------------------------------------------
// Hỗ trợ tìm kiếm theo tên/email/SĐT/chuyên khoa/bằng cấp, phân trang, và
// kèm theo 2 con số thống kê nhanh: bao nhiêu bác sĩ đã được gán chuyên khoa
// (assigned) và bao nhiêu tài khoản bác sĩ đang hoạt động (active).
// ============================================================================
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DoctorSpecialtyProfileResponseDto,
  PendingDoctorSpecialtyUpdateResponseDto,
} from '../../dtos/doctor-specialties/doctor-specialty-response.dto';
import { ListDoctorSpecialtyProfilesQueryDto } from '../../dtos/doctor-specialties/list-doctor-specialty-profiles-query.dto';
import { buildPaginationMeta, PaginationMeta } from '../../dtos/pagination.dto';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

const doctorUserInclude = {
  doctorProfile: {
    include: {
      specialty: true,
      certificationFiles: true,
      pendingUpdate: {
        include: {
          specialty: true,
        },
      },
    },
  },
} satisfies Prisma.UserInclude;

type DoctorUserWithProfile = Prisma.UserGetPayload<{
  include: typeof doctorUserInclude;
}>;

export interface ListDoctorSpecialtyProfilesResult {
  items: DoctorSpecialtyProfileResponseDto[];
  meta: PaginationMeta;
  summary: {
    assigned: number;
    active: number;
  };
}

@Injectable()
export class ListDoctorSpecialtyProfilesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ListDoctorSpecialtyProfilesQueryDto): Promise<ListDoctorSpecialtyProfilesResult> {
    const search = query.search?.trim();
    // Điều kiện lọc: luôn chỉ lấy tài khoản có vai trò BÁC SĨ và chưa bị xóa.
    // Nếu Admin có nhập từ khóa tìm kiếm, mở rộng thêm điều kiện: khớp 1
    // TRONG SỐ các trường sau (họ tên / email / SĐT / tên chuyên khoa / bằng
    // cấp) — không cần khớp cả 5, chỉ cần 1 trường có chứa từ khóa là được.
    const where: Prisma.UserWhereInput = {
      role: UserRole.DOCTOR,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { email: { contains: search } },
              { phone: { contains: search } },
              { doctorProfile: { is: { specialty: { is: { name: { contains: search } } } } } },
              { doctorProfile: { is: { degree: { contains: search } } } },
            ],
          }
        : {}),
    };

    // Chạy song song 4 truy vấn database cho nhanh (thay vì hỏi tuần tự):
    //   1. rows    — danh sách bác sĩ của TRANG hiện tại (đã phân trang).
    //   2. total   — tổng số bác sĩ khớp điều kiện tìm kiếm (để tính số trang).
    //   3. assigned — trong số đó, có bao nhiêu người đã được gán chuyên khoa.
    //   4. active   — trong số đó, có bao nhiêu tài khoản đang hoạt động.
    const [rows, total, assigned, active] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: doctorUserInclude,
        orderBy: { fullName: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.count({
        where: {
          ...where,
          doctorProfile: {
            is: {
              specialtyId: { not: null },
            },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          ...where,
          isActive: true,
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.toDto(row)),
      meta: buildPaginationMeta(query.page, query.limit, total),
      summary: {
        assigned,
        active,
      },
    };
  }

  private toDto(row: DoctorUserWithProfile): DoctorSpecialtyProfileResponseDto {
    return {
      id: row.doctorProfile?.id ?? null,
      userId: row.id,
      fullName: DoctorDisplayName.format(row.fullName),
      email: row.email,
      phone: row.phone,
      isActive: row.isActive,
      specialtyId: row.doctorProfile?.specialtyId ?? null,
      specialtyName: row.doctorProfile?.specialty?.name ?? null,
      specialtyDescription: row.doctorProfile?.specialty?.description ?? null,
      subspecialty: row.doctorProfile?.subspecialty ?? null,
      degree: row.doctorProfile?.degree ?? null,
      certification: row.doctorProfile?.certification ?? null,
      certificationFiles:
        row.doctorProfile?.certificationFiles.map((file) => ({
          id: file.id,
          fileUrl: file.fileUrl,
          originalName: file.originalName,
          uploadedAt: file.uploadedAt.toISOString(),
        })) ?? [],
      yearsExperience: row.doctorProfile?.yearsExperience ?? null,
      biography: row.doctorProfile?.biography ?? null,
      avatarUrl: row.doctorProfile?.avatarUrl ?? null,
      approvalStatus: row.doctorProfile?.approvalStatus ?? null,
      pendingUpdate: row.doctorProfile?.pendingUpdate ? this.toPendingDto(row.doctorProfile.pendingUpdate) : null,
      updatedAt: row.doctorProfile?.updatedAt.toISOString() ?? null,
    };
  }

  private toPendingDto(
    row: NonNullable<NonNullable<DoctorUserWithProfile['doctorProfile']>['pendingUpdate']>,
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
