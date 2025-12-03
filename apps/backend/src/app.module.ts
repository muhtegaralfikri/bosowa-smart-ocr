import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OcrModule } from './ocr/ocr.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, OcrModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
