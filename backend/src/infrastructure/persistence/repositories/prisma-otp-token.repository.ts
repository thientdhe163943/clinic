import { Injectable } from '@nestjs/common';
import { OtpToken as PrismaOtpToken } from '@prisma/client';
import { OtpToken } from '../../../domain/entities/otp-token.entity';
import { OtpPurpose } from '../../../domain/enums/otp-purpose.enum';
import { CreateOtpTokenData, OtpTokenRepository } from '../../../domain/repositories/otp-token.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaOtpTokenRepository implements OtpTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOtpTokenData): Promise<OtpToken> {
    const row = await this.prisma.otpToken.create({
      data: {
        userId: data.userId,
        otpCode: data.otpCode,
        purpose: data.purpose,
        expiresAt: data.expiresAt,
      },
    });

    return this.toDomain(row);
  }

  async findActiveByCode(userId: string, purpose: OtpPurpose, otpCode: string): Promise<OtpToken | null> {
    const row = await this.prisma.otpToken.findFirst({
      where: {
        userId,
        purpose,
        otpCode,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return row ? this.toDomain(row) : null;
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.otpToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  async invalidateAllForUser(userId: string, purpose: OtpPurpose): Promise<void> {
    await this.prisma.otpToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private toDomain(row: PrismaOtpToken): OtpToken {
    return new OtpToken(row.id, row.userId, row.otpCode, row.purpose as OtpPurpose, row.expiresAt, row.usedAt, row.createdAt);
  }
}
