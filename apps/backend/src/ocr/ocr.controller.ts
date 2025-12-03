import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Patch,
  Param,
  Body,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SearchDto } from './dto/search.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateDocumentDto } from './dto/update-document.dto';

@Controller('ocr')
@UseGuards(JwtAuthGuard)
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

  @Patch(':id')
  async updateDocument(
    @Param('id') id: string,
    @Body() body: UpdateDocumentDto,
  ) {
    return this.ocrService.updateDocument(id, body);
  }

  @Get('search')
  async search(@Query() query: SearchDto) {
    return this.ocrService.searchDocuments(query);
  }
}
