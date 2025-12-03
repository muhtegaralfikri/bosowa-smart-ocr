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
  Req,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SearchDto } from './dto/search.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DeleteRequestDto } from './dto/delete-request.dto';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('ocr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('scan')
  @UseInterceptors(FileInterceptor('file')) // Nama field di form-data harus 'file'
  async scanDocument(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user?: { userId?: string } },
  ): Promise<unknown> {
    // Validasi sederhana
    if (!file) {
      throw new BadRequestException('File tidak ditemukan!');
    }

    // Panggil service
    return this.ocrService.processImage(file, req.user?.userId);
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

  @Post(':id/delete-request')
  async requestDelete(
    @Param('id') id: string,
    @Body() body: DeleteRequestDto,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.ocrService.requestDelete(id, req.user?.userId, body.reason);
  }

  @Post('delete-requests/:requestId/approve')
  @Roles(Role.ADMIN)
  async approveDelete(
    @Param('requestId') requestId: string,
    @Req() req: { user?: { userId?: string } },
  ) {
    return this.ocrService.approveDelete(requestId, req.user?.userId);
  }
}
