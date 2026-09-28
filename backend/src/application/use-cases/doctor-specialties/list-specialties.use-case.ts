import { Injectable } from '@nestjs/common';
import { SpecialtyOptionResponseDto } from '../../dtos/doctor-specialties/doctor-specialty-response.dto';
import { PrismaService } from '../../../infrastructure/persistence/prisma/prisma.service';

@Injectable()
export class ListSpecialtiesUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<SpecialtyOptionResponseDto[]> {
    const rows = await this.prisma.specialty.findMany({
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
    }));
  }
}
