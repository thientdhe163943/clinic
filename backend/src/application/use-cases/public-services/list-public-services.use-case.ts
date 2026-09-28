import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PublicServiceListItemDto } from '../../dtos/public-services/public-service-response.dto';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

export interface ListPublicServicesInput {
  search?: string;
  specialtyId?: string;
}

const SPECIALTY_NONE_KEY = '__none__';

const serviceInclude = {
  specialty: true,
} satisfies Prisma.ServiceInclude;

type ServiceWithRelations = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

export function toPublicServiceListItem(row: ServiceWithRelations): PublicServiceListItemDto {
  return {
    id: row.id,
    serviceCode: row.serviceCode,
    name: row.name,
    specialtyId: row.specialtyId,
    specialtyName: row.specialty?.name ?? null,
    price: Number(row.price),
    description: row.description,
  };
}

@Injectable()
export class ListPublicServicesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(input: ListPublicServicesInput): Promise<PublicServiceListItemDto[]> {
    const search = input.search?.trim();
    const specialtyId = input.specialtyId?.trim();
    const isBrowseAll = !search && !specialtyId;

    const rows = await this.prisma.service.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(specialtyId ? { specialtyId } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { serviceCode: { contains: search } },
              ],
            }
          : {}),
      },
      include: serviceInclude,
      orderBy: { name: 'asc' },
    });

    // Default (no search/filter) view: the clinic-info page is a highlight
    // page, not the full catalog — show only the most-used active service
    // per specialty instead of every active service.
    if (!isBrowseAll) return rows.map(toPublicServiceListItem);

    const usageCountByServiceId = await this.getUsageCountByServiceId(rows.map((row) => row.id));

    const topRowByGroup = new Map<string, ServiceWithRelations>();
    for (const row of rows) {
      const groupKey = row.specialtyId ?? SPECIALTY_NONE_KEY;
      const current = topRowByGroup.get(groupKey);
      const rowUsage = usageCountByServiceId.get(row.id) ?? 0;
      const currentUsage = current ? (usageCountByServiceId.get(current.id) ?? 0) : -1;
      if (!current || rowUsage > currentUsage) topRowByGroup.set(groupKey, row);
    }

    return [...topRowByGroup.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(toPublicServiceListItem);
  }

  private async getUsageCountByServiceId(serviceIds: string[]): Promise<Map<string, number>> {
    if (serviceIds.length === 0) return new Map();

    const grouped = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      where: {
        serviceId: { in: serviceIds },
        status: { not: AppointmentStatus.CANCELLED },
      },
      _count: { serviceId: true },
    });

    // serviceId is nullable at the DB level (doctor-less/service-less
    // bookings — see CreateAppointmentUseCase's optional-service booking),
    // but the `serviceId: { in: serviceIds }` filter above already excludes
    // null rows in practice; the null-check here just satisfies the type.
    return new Map(
      grouped
        .filter((row): row is typeof row & { serviceId: string } => row.serviceId !== null)
        .map((row) => [row.serviceId, row._count.serviceId]),
    );
  }
}
