import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('scan')
  @UseInterceptors(FileInterceptor('file')) // Nama field di form-data harus 'file'
  async scanDocument(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<unknown> {
    // Validasi sederhana
    if (!file) {
      throw new BadRequestException('File tidak ditemukan!');
    }

    // Panggil service
    return this.ocrService.processImage(file);
  }
}
