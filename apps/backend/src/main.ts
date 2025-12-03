import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS (Biar Next.js di port 3000 bisa akses)
  app.enableCors();

  // Serve uploaded files statically so URLs like /uploads/<file> work in production.
  const uploadDir =
    process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadDir));

  const port = Number(process.env.PORT) || 4000;

  await app.listen(port);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
