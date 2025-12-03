import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { HttpModule } from '@nestjs/axios'; // <--- Import ini
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [HttpModule], // <--- Masukkan ke imports
  controllers: [OcrController],
  providers: [OcrService, RolesGuard],
})
export class OcrModule {}
