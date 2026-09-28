import { Injectable } from '@nestjs/common';
import { Specialty as PrismaSpecialty } from '@prisma/client';
import { Specialty } from '../../../domain/entities/specialty.entity';
import { SpecialtyRepository } from '../../../domain/repositories/specialty.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaSpecialtyRepository implements SpecialtyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Specialty | null> {
    const row = await this.prisma.specialty.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Specialty[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.specialty.findMany({ where: { id: { in: ids } } });
    return rows.map((row) => this.toDomain(row));
  }

  async findAll(): Promise<Specialty[]> {
    const rows = await this.prisma.specialty.findMany({ orderBy: { name: 'asc' } });
    return rows.map((row) => this.toDomain(row));
  }

  async findByName(name: string): Promise<Specialty | null> {
    const row = await this.prisma.specialty.findFirst({ where: { name } });
    return row ? this.toDomain(row) : null;
  }

  async create(data: { name: string; description?: string | null }): Promise<Specialty> {
    const row = await this.prisma.specialty.create({
      data: { name: data.name, description: data.description ?? null },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: { name?: string; description?: string | null }): Promise<Specialty> {
    const row = await this.prisma.specialty.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
    });
    return this.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.specialty.delete({ where: { id } });
  }

  async isInUse(id: string): Promise<boolean> {
    const count = await this.prisma.doctorProfile.count({ where: { specialtyId: id } });
    if (count > 0) return true;
    const svcCount = await this.prisma.service.count({ where: { specialtyId: id } });
    return svcCount > 0;
  }

  private toDomain(row: PrismaSpecialty): Specialty {
    return new Specialty(row.id, row.name, row.description, row.createdAt, row.updatedAt);
  }
}
