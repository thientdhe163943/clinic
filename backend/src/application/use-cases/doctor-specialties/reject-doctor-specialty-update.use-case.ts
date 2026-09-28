import { Inject, Injectable } from '@nestjs/common';
import { DoctorProfileApprovalStatus } from '@prisma/client';
import { RejectDoctorSpecialtyUpdateDto } from '../../dtos/doctor-specialties/reject-doctor-specialty-update.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { REALTIME_PORT, RealtimePort } from '../../ports/realtime.port';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class RejectDoctorSpecialtyUpdateUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REALTIME_PORT) private readonly realtimePort: RealtimePort,
  ) {}

  async execute(doctorUserId: string, reviewedBy: string, input: RejectDoctorSpecialtyUpdateDto): Promise<void> {
    const profile = await this.prisma.doctorProfile.findFirst({
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

    const nextApprovalStatus =
      profile.specialtyId && profile.approvalStatus === DoctorProfileApprovalStatus.APPROVED
        ? DoctorProfileApprovalStatus.APPROVED
        : DoctorProfileApprovalStatus.REJECTED;

    await this.prisma.$transaction([
      this.prisma.doctorProfilePendingUpdate.update({
        where: { id: profile.pendingUpdate.id },
        data: {
          status: DoctorProfileApprovalStatus.REJECTED,
          reviewedBy,
          reviewedAt: new Date(),
          rejectionReason: input.reason?.trim() || null,
        },
      }),
      this.prisma.doctorProfile.update({
        where: { id: profile.id },
        data: {
          approvalStatus: nextApprovalStatus,
          rejectedAt: new Date(),
          rejectedBy: reviewedBy,
          rejectionReason: input.reason?.trim() || null,
          updatedBy: reviewedBy,
        },
      }),
    ]);

    try {
      this.realtimePort.emit(doctorUserId, 'doctor-specialty:changed', {
        doctorProfileId: profile.id,
        status: nextApprovalStatus,
      });
    } catch {
      // Realtime notification is best-effort — never let it fail the write.
    }
  }
}
