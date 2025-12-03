import {
  Injectable,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import * as path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { DocStatus, DocType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type OcrResponse = { status?: string; data?: unknown } | unknown;

const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000';
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads');

@Injectable()
export class OcrService {
  constructor(
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  async processImage(file: Express.Multer.File): Promise<unknown> {
    if (!file) {
      throw new HttpException('File tidak ditemukan!', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.ensureUploadDir();

      const formData = new FormData();
      formData.append('file', file.buffer, file.originalname);

      const response = await firstValueFrom(
        this.httpService.post<OcrResponse>(
          `${PYTHON_SERVICE_URL}/process-ocr`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
            },
          },
        ),
      );

      const ocrResult = response.data;
      const savedFile = await this.saveUploadedFile(file);
      const document = await this.persistDocument(ocrResult, savedFile);

      return {
        status: 'success',
        documentId: document.id,
        data: ocrResult,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Error contacting Python Service:', error.message);
      } else {
        console.error('Error contacting Python Service:', error);
      }
      throw new HttpException(
        'Gagal memproses gambar di engine AI',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    } catch (err) {
      console.error('Failed creating upload dir', err);
      throw new InternalServerErrorException('Gagal menyiapkan folder upload');
    }
  }

  private async saveUploadedFile(file: Express.Multer.File): Promise<{
    fileName: string;
    filePath: string;
    mimeType: string;
  }> {
    const ext = path.extname(file.originalname) || '.bin';
    const fileName = `${randomUUID()}${ext}`;
    const targetPath = path.join(UPLOAD_DIR, fileName);

    try {
      await fs.writeFile(targetPath, file.buffer);
      const relativePath = path.relative(process.cwd(), targetPath);
      return { fileName, filePath: relativePath, mimeType: file.mimetype };
    } catch (err) {
      console.error('Failed saving upload', err);
      throw new InternalServerErrorException('Gagal menyimpan file upload');
    }
  }

  private async persistDocument(
    ocrResult: unknown,
    fileMeta: { fileName: string; filePath: string; mimeType: string },
  ) {
    const data: Prisma.DocumentCreateInput = {
      fileName: fileMeta.fileName,
      filePath: fileMeta.filePath,
      mimeType: fileMeta.mimeType,
      type: DocType.LAINNYA,
      status: DocStatus.PENDING,
      rawOcr: ocrResult as Prisma.InputJsonValue,
    };

    return this.prisma.document.create({ data });
  }
}
