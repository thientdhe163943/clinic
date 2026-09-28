import { Injectable } from '@nestjs/common';
import { Room as PrismaRoom } from '@prisma/client';
import { Room } from '../../../domain/entities/room.entity';
import { RoomType } from '../../../domain/enums/room-type.enum';
import { ClsRoomCategory } from '../../../domain/enums/cls-room-category.enum';
import { RoomRepository, CreateRoomData, UpdateRoomData } from '../../../domain/repositories/room.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Room[]> {
    const rows = await this.prisma.room.findMany({ where: { deletedAt: null } });
    return rows.map((row) => this.toDomain(row));
  }

  async findAllByType(type: RoomType, isActive?: boolean): Promise<Room[]> {
    const rows = await this.prisma.room.findMany({
      where: { type, deletedAt: null, ...(isActive !== undefined ? { isActive } : {}) },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findAllByClsCategory(category: ClsRoomCategory, isActive?: boolean): Promise<Room[]> {
    const rows = await this.prisma.room.findMany({
      where: {
        type: 'CLS',
        clsCategory: category,
        deletedAt: null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.room.findFirst({ where: { id, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Room | null> {
    const row = await this.prisma.room.findFirst({ where: { roomCode: code, deletedAt: null } });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string, excludeId?: string): Promise<Room | null> {
    const row = await this.prisma.room.findFirst({
      where: { name, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
    });
    return row ? this.toDomain(row) : null;
  }

  countUnfinishedClsOrders(roomId: string): Promise<number> {
    return this.prisma.clsOrder.count({
      where: { clsRoomId: roomId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
  }

  async create(data: CreateRoomData): Promise<Room> {
    const row = await this.prisma.room.create({
      data: {
        roomCode: data.roomCode,
        name: data.name,
        type: data.type as any,
        description: data.description,
        techniqueType: data.techniqueType,
        clsCategory: data.clsCategory ?? null,
        specialtyId: data.specialtyId ?? null,
        isActive: true,
        createdBy: data.createdBy,
      },
    });
    return this.toDomain(row);
  }

  async update(id: string, data: UpdateRoomData): Promise<Room> {
    const row = await this.prisma.room.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type as any,
        description: data.description,
        techniqueType: data.techniqueType,
        clsCategory: data.clsCategory,
        ...(data.specialtyId !== undefined && { specialtyId: data.specialtyId }),
        updatedBy: data.updatedBy,
      },
    });
    return this.toDomain(row);
  }

  async setActive(id: string, isActive: boolean, updatedBy?: string): Promise<Room> {
    const row = await this.prisma.room.update({
      where: { id },
      data: {
        isActive,
        updatedBy,
      },
    });
    return this.toDomain(row);
  }

  private toDomain(row: PrismaRoom): Room {
    return new Room(
      row.id,
      row.roomCode,
      row.name,
      row.type as RoomType,
      row.description,
      row.techniqueType,
      row.clsCategory as ClsRoomCategory | null,
      row.specialtyId,
      row.isActive,
      row.createdAt,
      row.updatedAt,
    );
  }
}
