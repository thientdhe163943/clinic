import { Injectable } from '@nestjs/common';
import { DoctorProfileApprovalStatus, Prisma, ServiceType } from '@prisma/client';
import { ListPublicDoctorsQueryDto } from '../../dtos/public-doctors/list-public-doctors-query.dto';
import { PublicDoctorListItemDto } from '../../dtos/public-doctors/public-doctor-response.dto';
import { UserRole } from '../../../domain/enums/user-role.enum';
import { DoctorDisplayName } from '../../../domain/value-objects/doctor-display-name.vo';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';
import { DoctorSlotService } from '../../services/doctor-slot.service';
import { toDateOnly } from '../appointments/find-available-doctors.use-case';

const doctorProfileInclude = {
  user: true,
  specialty: true,
} satisfies Prisma.DoctorProfileInclude;

type DoctorProfileWithRelations = Prisma.DoctorProfileGetPayload<{
  include: typeof doctorProfileInclude;
}>;

export interface DoctorPriceRange {
  priceFrom: number;
  priceTo: number;
}

/**
 * Min/max active EXAMINATION service price per specialtyId, grouped in a
 * single query for the whole result set to avoid N+1 (one query per doctor).
 * Shared by ListPublicDoctorsUseCase and GetPublicDoctorUseCase so both
 * expose the same priceFrom/priceTo fields consistently.
 */
export async function getPriceRangeBySpecialtyId(
  prisma: PrismaService,
  specialtyIds: string[],
): Promise<Map<string, DoctorPriceRange>> {
  if (specialtyIds.length === 0) return new Map();

  const grouped = await prisma.service.groupBy({
    by: ['specialtyId'],
    where: {
      specialtyId: { in: specialtyIds },
      type: ServiceType.EXAMINATION,
      isActive: true,
      deletedAt: null,
    },
    _min: { price: true },
    _max: { price: true },
  });

  return new Map(
    grouped
      .filter((row): row is typeof row & { specialtyId: string } => row.specialtyId !== null)
      .map((row) => [
        row.specialtyId,
        { priceFrom: Number(row._min.price), priceTo: Number(row._max.price) },
      ]),
  );
}

export function toPublicDoctorListItem(
  row: DoctorProfileWithRelations,
  priceRange: DoctorPriceRange | null,
): PublicDoctorListItemDto {
  return {
    id: row.id,
    userId: row.userId,
    fullName: DoctorDisplayName.format(row.user.fullName),
    specialtyId: row.specialtyId,
    specialtyName: row.specialty?.name ?? null,
    subspecialty: row.subspecialty,
    degree: row.degree,
    yearsExperience: row.yearsExperience,
    biography: row.biography,
    avatarUrl: row.avatarUrl,
    priceFrom: priceRange?.priceFrom ?? null,
    priceTo: priceRange?.priceTo ?? null,
  };
}

@Injectable()
export class ListPublicDoctorsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly doctorSlotService: DoctorSlotService,
  ) {}

  async execute(query: ListPublicDoctorsQueryDto = {}): Promise<PublicDoctorListItemDto[]> {
    const search = query.search?.trim();
    const degree = query.degree?.trim();
    const rows = await this.prisma.doctorProfile.findMany({
      where: {
        specialtyId: query.specialtyId?.trim() || { not: null },
        approvalStatus: DoctorProfileApprovalStatus.APPROVED,
        ...(query.minYearsExperience != null ? { yearsExperience: { gte: query.minYearsExperience } } : {}),
        ...(degree ? { degree: { contains: degree } } : {}),
        ...(search
          ? {
              OR: [
                { user: { fullName: { contains: search } } },
                { specialty: { is: { name: { contains: search } } } },
                { degree: { contains: search } },
              ],
            }
          : {}),
        // fullName search lives in the OR clause above (alongside specialty
        // name / degree) — it must NOT also be required here, or Prisma's
        // implicit top-level AND would force every match to also hit
        // fullName, defeating the "match by specialty OR degree" intent.
        user: {
          role: UserRole.DOCTOR,
          isActive: true,
          deletedAt: null,
        },
      },
      include: doctorProfileInclude,
      orderBy: [{ yearsExperience: 'desc' }, { user: { fullName: 'asc' } }],
    });

    const specialtyIds = [
      ...new Set(rows.map((row) => row.specialtyId).filter((id): id is string => id !== null)),
    ];
    const priceRangeBySpecialtyId = await getPriceRangeBySpecialtyId(this.prisma, specialtyIds);

    let items = rows.map((row) =>
      toPublicDoctorListItem(row, row.specialtyId ? priceRangeBySpecialtyId.get(row.specialtyId) ?? null : null),
    );

    // Business Rule: when `date` is given, only doctors with at least one
    // bookable slot that day are returned — reuses DoctorSlotService (the
    // same WorkSchedule + booked-appointment exclusion logic the booking
    // flow's available-doctors endpoint already uses), not a new query.
    if (query.date) {
      const day = toDateOnly(query.date);
      const availability = await Promise.all(
        items.map((item) => this.doctorSlotService.hasAvailableSlot(item.userId, day)),
      );
      items = items.filter((_, index) => availability[index]);
    }

    return items;
  }
}
