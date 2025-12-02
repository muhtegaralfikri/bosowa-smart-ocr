import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Enable CORS (Biar Next.js di port 3000 bisa akses)
  app.enableCors();

  // 2. Ubah Port jadi 4000
  await app.listen(4000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
void bootstrap();
