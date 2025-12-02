import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { HttpModule } from '@nestjs/axios'; // <--- Import ini

@Module({
  imports: [HttpModule], // <--- Masukkan ke imports
  controllers: [OcrController],
  providers: [OcrService],
})
export class OcrModule {}
