import { Injectable } from '@nestjs/common';
import { DoctorProfileApprovalStatus, Prisma } from '@prisma/client';
import { PublicDoctorDetailDto } from '../../dtos/public-doctors/public-doctor-response.dto';
import { ResourceNotFoundError } from '../../errors/application-error';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { getPriceRangeBySpecialtyId } from './list-public-doctors.use-case';

const doctorProfileInclude = {
  user: true,
  specialty: true,
} satisfies Prisma.DoctorProfileInclude;

@Injectable()
export class GetPublicDoctorUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string): Promise<PublicDoctorDetailDto> {
    const row = await this.prisma.doctorProfile.findFirst({
      where: {
        id,
        specialtyId: { not: null },
        approvalStatus: DoctorProfileApprovalStatus.APPROVED,
        user: {
          role: UserRole.DOCTOR,
          isActive: true,
          deletedAt: null,
        },
      },
      include: doctorProfileInclude,
    });

    if (!row) throw new ResourceNotFoundError('Doctor profile', { id });

    const priceRangeBySpecialtyId = await getPriceRangeBySpecialtyId(
      this.prisma,
      row.specialtyId ? [row.specialtyId] : [],
    );
    const priceRange = row.specialtyId ? priceRangeBySpecialtyId.get(row.specialtyId) ?? null : null;

    return {
      id: row.id,
      userId: row.userId,
      fullName: DoctorDisplayName.format(row.user.fullName),
      specialtyId: row.specialtyId,
      specialtyName: row.specialty?.name ?? null,
      specialtyDescription: row.specialty?.description ?? null,
      subspecialty: row.subspecialty,
      degree: row.degree,
      yearsExperience: row.yearsExperience,
      biography: row.biography,
      avatarUrl: row.avatarUrl,
      priceFrom: priceRange?.priceFrom ?? null,
      priceTo: priceRange?.priceTo ?? null,
    };
  }
}
