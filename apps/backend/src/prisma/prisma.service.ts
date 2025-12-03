import 'dotenv/config';
import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

const buildAdapter = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const url = new URL(databaseUrl);
  if (!url.hostname) {
    throw new Error('Invalid DATABASE_URL: missing host');
  }
  const poolConfig = {
    host: url.hostname,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    port: url.port ? Number(url.port) : 3306,
    database: url.pathname.replace(/^\//, '') || undefined,
  };
  return new PrismaMariaDb(poolConfig);
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter: buildAdapter() });
  }

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
