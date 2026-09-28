import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  // Connect eagerly on startup instead of lazily on first query, so a
  // misconfigured DATABASE_URL fails fast during boot.
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to MySQL database');
  }

  // Release the connection pool when Nest shuts down (e.g. during tests
  // or graceful shutdown) to avoid dangling MySQL connections.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
