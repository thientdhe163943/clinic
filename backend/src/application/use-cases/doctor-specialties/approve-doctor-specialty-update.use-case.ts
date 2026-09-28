import { Inject, Injectable } from '@nestjs/common';
import { DoctorProfileApprovalStatus, Prisma } from '@prisma/client';
import { DoctorSpecialtyProfileResponseDto } from '../../dtos/doctor-specialties/doctor-specialty-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { UserRole } from '../../../domain/enums/user-role.enum';
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
export class ApproveDoctorSpecialtyUpdateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(doctorUserId: string, reviewedBy: string): Promise<DoctorSpecialtyProfileResponseDto> {
    const row = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.doctorProfile.findFirst({
        where: {
          userId: doctorUserId,
          user: {
            role: UserRole.DOCTOR,
            deletedAt: null,
          },
        },
        include: {
          pendingUpdate: true,
        },
      });

      if (!profile?.pendingUpdate || profile.pendingUpdate.status !== DoctorProfileApprovalStatus.PENDING_APPROVAL) {
        throw new ResourceNotFoundError('Pending doctor specialty update', { doctorUserId });
      }
      const pendingUpdate = profile.pendingUpdate;

      await tx.doctorProfile.update({
        where: { id: profile.id },
        data: {
          specialtyId: pendingUpdate.specialtyId,
          subspecialty: pendingUpdate.subspecialty,
          degree: pendingUpdate.degree,
          certification: pendingUpdate.certification,
          yearsExperience: pendingUpdate.yearsExperience,
          biography: pendingUpdate.biography,
          avatarUrl: pendingUpdate.avatarUrl,
          approvalStatus: DoctorProfileApprovalStatus.APPROVED,
          approvedAt: new Date(),
          approvedBy: reviewedBy,
          rejectedAt: null,
          rejectedBy: null,
          rejectionReason: null,
          updatedBy: reviewedBy,
        },
      });

      await tx.doctorCertificationFile.deleteMany({ where: { doctorProfileId: profile.id } });
      const files = this.parseCertificationFileUrls(pendingUpdate.certificationFileUrls).map((url) => ({
        doctorProfileId: profile.id,
        fileUrl: url,
        originalName: this.getFileNameFromUrl(url),
        uploadedBy: pendingUpdate.submittedBy,
      }));
      if (files.length) await tx.doctorCertificationFile.createMany({ data: files });

      await tx.doctorProfilePendingUpdate.delete({ where: { id: pendingUpdate.id } });

      return tx.doctorProfile.findUniqueOrThrow({
        where: { id: profile.id },
        include: doctorProfileInclude,
      });
    });

    try {
      this.realtimePort.emit(doctorUserId, 'doctor-specialty:changed', {
        doctorProfileId: row.id,
        status: row.approvalStatus,
      });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }

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
      pendingUpdate: null,
      updatedAt: row.updatedAt.toISOString(),
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
