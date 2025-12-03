import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateStatusDto } from './dto/update-status.dto';

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

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    return this.ocrService.updateStatus(id, body);
  }
}
