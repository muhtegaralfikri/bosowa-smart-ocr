import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication): Promise<void> {
    // Prisma Client v5 typings omit 'beforeExit'; use a broad cast to keep type checker happy.
    (this.$on as any)('beforeExit', async () => {
      await app.close();
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
