import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Global Prisma Database Service using Prisma v7 driver adapter architecture.
 * Provides singleton connection lifecycle and graceful error handling on bootstrap.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString =
      process.env.DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/softilo_marketplace?schema=public';
    
    // Initialize PostgreSQL driver adapter for Prisma 7
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma client connected to PostgreSQL database successfully.');
    } catch (error) {
      this.logger.warn(
        `Prisma database connection deferred (PostgreSQL may be starting or offline): ${(error as Error).message}`,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

