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
import { UpdateStatusDto } from './dto/update-status.dto';
import { SearchDto } from './dto/search.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

type OcrItem = { text?: string; confidence?: number };
type OcrResponse = { status?: string; data?: OcrItem[] } | unknown;
type ParsedFields = {
  invoiceNo?: string;
  letterNo?: string;
  docDate?: Date;
  sender?: string;
  amount?: Prisma.Decimal;
  address?: string;
  email?: string;
  phone?: string;
  type?: DocType;
};

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
      // Python service already wraps result as { status, data }; flatten here for frontend + metadata parsing.
      const flattenedData: OcrItem[] =
        ((ocrResult as { data?: OcrItem[] })?.data as OcrItem[]) ||
        ((Array.isArray(ocrResult) ? ocrResult : []) as OcrItem[]);
      const savedFile = await this.saveUploadedFile(file);
      const document = await this.persistDocument(
        ocrResult,
        flattenedData,
        savedFile,
      );

      return {
        status: 'success',
        documentId: document.id,
        data: flattenedData,
        extracted: this.parseMetadata(flattenedData),
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

  async updateStatus(
    id: string,
    dto: UpdateStatusDto = { status: DocStatus.VERIFIED },
  ) {
    const status = dto.status ?? DocStatus.VERIFIED;
    return this.prisma.document.update({
      where: { id },
      data: { status },
    });
  }

  async updateDocument(id: string, dto: UpdateDocumentDto) {
    const data: Prisma.DocumentUpdateInput = {};
    if (dto.invoiceNo !== undefined) data.invoiceNo = dto.invoiceNo || null;
    if (dto.letterNo !== undefined) data.letterNo = dto.letterNo || null;
    if (dto.docDate !== undefined) {
      const parsed = dto.docDate ? new Date(dto.docDate) : null;
      data.docDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    if (dto.sender !== undefined) data.sender = dto.sender || null;
    if (dto.amount !== undefined) {
      const num = dto.amount
        ? Number(String(dto.amount).replace(/[.,]/g, ''))
        : NaN;
      data.amount = Number.isFinite(num) ? new Prisma.Decimal(num) : null;
    }
    if (dto.rawOcr !== undefined) {
      data.rawOcr = dto.rawOcr as Prisma.InputJsonValue;
    }

    return this.prisma.document.update({
      where: { id },
      data,
    });
  }

  async searchDocuments(query: SearchDto) {
    const { invoiceNo, letterNo } = query;
    if (!invoiceNo && !letterNo) {
      return [];
    }

    return this.prisma.document.findMany({
      where: {
        AND: [
          invoiceNo
            ? {
                invoiceNo: {
                  contains: invoiceNo,
                },
              }
            : {},
          letterNo
            ? {
                letterNo: {
                  contains: letterNo,
                },
              }
            : {},
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
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
      const relativePath = path
        .relative(process.cwd(), targetPath)
        .replace(/\\/g, '/');
      return { fileName, filePath: relativePath, mimeType: file.mimetype };
    } catch (err) {
      console.error('Failed saving upload', err);
      throw new InternalServerErrorException('Gagal menyimpan file upload');
    }
  }

  private async persistDocument(
    ocrResult: unknown,
    flattenedData: OcrItem[],
    fileMeta: { fileName: string; filePath: string; mimeType: string },
  ) {
    const parsed = this.parseMetadata(flattenedData);

    const data: Prisma.DocumentCreateInput = {
      fileName: fileMeta.fileName,
      filePath: fileMeta.filePath,
      mimeType: fileMeta.mimeType,
      type: parsed.type ?? DocType.LAINNYA,
      status: DocStatus.PENDING,
      invoiceNo: parsed.invoiceNo,
      letterNo: parsed.letterNo,
      docDate: parsed.docDate,
      sender: parsed.sender,
      amount: parsed.amount,
      rawOcr: ocrResult as Prisma.InputJsonValue,
    };

    return this.prisma.document.create({ data });
  }

  private parseMetadata(data: OcrItem[]) {
    if (!Array.isArray(data)) return {};

    const sanitize = (text: string) => text.replace(/^\s*[:：]\s*/, '').trim();
    const texts = data
      .map((item) => sanitize(item?.text ?? ''))
      .filter(Boolean);
    const joined = texts.join(' ').replace(/\s+/g, ' ');
    const lowerJoined = joined.toLowerCase();

    const invoiceMatch =
      joined.match(
        /(?:invoice\s*(?:no|number|#)?\s*[:-]?\s*)([A-Z0-9/-]{5,})/i,
      ) ||
      texts.find((t) => /^inv[-\s]/i.test(t))?.match(/(inv[-\s]?[A-Z0-9/-]+)/i);
    const letterMatch =
      joined.match(
        /(?:surat|letter)\s*(?:no|number|#)?\s*[:-]?\s*([A-Z0-9/-]{3,})/i,
      ) ||
      texts
        .find((t) => /^no\b/i.test(t))
        ?.match(/(?:no|nomor)[\s.:]*([A-Z0-9/-]+)/i);

    const dateMatch =
      joined.match(
        /(\d{1,2}(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i,
      ) ||
      joined.match(
        /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/,
      );

    const emailMatch = joined.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    const phoneMatch = joined.match(
      /(\+?\d{2,3}[-\s.]?\d{3,4}[-\s.]?\d{3,4,})/,
    );

    const amountMatch = joined.match(
      /(?:rp\.?\s*)?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i,
    );
    const senderMatch =
      joined.match(/(?:from|dari)[:\s]+([A-Za-z0-9 .,&-]{3,50})/i)?.[1] ||
      texts.find((t) => t.length > 3 && t.length < 80);

    const addressCandidate = texts.find(
      (t) =>
        /(jl\.|jalan|street|road|ave|serpong|city|rt|rw)/i.test(t) ||
        /\d{3,} [A-Za-z]/.test(t),
    );

    const docDate = dateMatch ? this.parseDate(dateMatch[1]) : undefined;
    const amount = amountMatch ? this.parseAmount(amountMatch[1]) : undefined;
    const type = invoiceMatch
      ? DocType.INVOICE
      : lowerJoined.includes('surat')
        ? DocType.SURAT_RESMI
        : DocType.LAINNYA;

    return {
      invoiceNo: invoiceMatch?.[1],
      letterNo: letterMatch?.[1],
      docDate,
      sender: senderMatch ? senderMatch.trim() : undefined,
      amount,
      type,
      address: addressCandidate,
      email: emailMatch?.[1],
      phone: phoneMatch?.[1],
    } satisfies ParsedFields;
  }

  private parseDate(input: string): Date | undefined {
    const months: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    };

    const monthName = input.match(
      /(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t)?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)/i,
    );
    if (monthName) {
      const dayMatch = input.match(/(\d{1,2})(?:st|nd|rd|th)?/);
      const yearMatch = input.match(/(\d{4})/);
      const month = months[monthName[1].toLowerCase()];
      const day = dayMatch ? Number(dayMatch[1]) : NaN;
      const year = yearMatch ? Number(yearMatch[1]) : NaN;
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const normalized = input.replace(/-/g, '/');
    const parts = normalized.split('/');
    if (parts.length !== 3) return undefined;

    let year = parts[0].length === 4 ? Number(parts[0]) : Number(parts[2]);
    const month = parts[0].length === 4 ? Number(parts[1]) : Number(parts[1]);
    const day = parts[0].length === 4 ? Number(parts[2]) : Number(parts[0]);

    if (year < 100) year += 2000;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private parseAmount(input: string): Prisma.Decimal | undefined {
    const normalized = input.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? new Prisma.Decimal(num) : undefined;
  }
}
