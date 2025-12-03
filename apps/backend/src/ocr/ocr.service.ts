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
      const extracted = this.parseMetadata(flattenedData);
      const document = await this.persistDocument(
        ocrResult,
        flattenedData,
        savedFile,
      );

      return {
        status: 'success',
        documentId: document.id,
        data: flattenedData,
        extracted: this.presentMetadata(extracted),
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
      const parsed = dto.docDate
        ? (this.parseDate(String(dto.docDate)) ?? null)
        : null;
      data.docDate = parsed;
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
    const letterMatch = this.extractLetterNo(texts, joined);

    const emailMatch = joined.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    const phoneMatch = this.extractPhoneNumber(texts, joined);
    const dateString = this.extractDate(texts, joined);

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

    const docDate = dateString ? this.parseDate(dateString) : undefined;
    const amount = amountMatch ? this.parseAmount(amountMatch[1]) : undefined;
    const type = invoiceMatch
      ? DocType.INVOICE
      : lowerJoined.includes('surat')
        ? DocType.SURAT_RESMI
        : DocType.LAINNYA;

    return {
      invoiceNo: invoiceMatch?.[1],
      letterNo: letterMatch,
      docDate,
      sender: senderMatch ? senderMatch.trim() : undefined,
      amount,
      type,
      address: addressCandidate,
      email: emailMatch?.[1],
      phone: phoneMatch,
    } satisfies ParsedFields;
  }

  private presentMetadata(meta: ParsedFields) {
    return {
      ...meta,
      docDate: meta.docDate ? this.formatDate(meta.docDate) : undefined,
    };
  }

  private extractDate(lines: string[], joined: string): string | undefined {
    const patterns: RegExp[] = [
      /(?:tanggal|tgl|date|issued on|issue date|printed|terbit|diterbitkan)[:.,\s-]*([A-Za-z0-9,./-]{6,})/i,
      /(\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})/i, // 12 Januari 2024
      /([A-Za-z]{3,}\s+\d{1,2},?\s+\d{2,4})/i, // Januari 12, 2024
      /(\d{4}[./-]\d{1,2}[./-]\d{1,2})/, // 2024-01-05
      /(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/, // 05/01/24 or 05/01/2024
      /(\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4})/i, // 05 Jan 24
    ];

    const findMatch = (text: string) =>
      patterns.map((pattern) => text.match(pattern)?.[1]).find((val) => !!val);

    const fromLines = lines.map(findMatch).find(Boolean);
    const fromJoined = findMatch(joined);

    return fromLines ?? fromJoined;
  }

  private extractLetterNo(lines: string[], joined: string): string | undefined {
    const patterns: RegExp[] = [
      /(?:nomor|no\.?|no\s*surat|no\s*dok(?:umen)?|no\s*ref(?:erensi)?|reference|reff|ref|no\.?\s*sj|sj)[:\s.=~-]*([A-Z0-9./-]{2,})/i,
      /(?:surat|letter)\s*(?:no|number|#)?\s*[:.-=]?\s*([A-Z0-9./-]{2,})/i,
      /^(?:nomor|no\.?)[:.\s-]*([A-Z0-9./-]{2,})/i,
    ];

    const findMatch = (text: string) =>
      patterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean);

    const candidate = lines.map(findMatch).find(Boolean) ?? findMatch(joined);
    if (!candidate) return undefined;
    if (/^inv/i.test(candidate)) return undefined;
    return candidate;
  }

  // Try to capture telp/HP/fax numbers with common Indonesian formatting.
  private extractPhoneNumber(
    lines: string[],
    joined: string,
  ): string | undefined {
    const labeledPattern =
      /(?:telp|tel|tlp|hp|mobile|phone|telepon|fax|facsimile)[:.\s-]*([+0(]?\d[\d\s()./-]{5,})/i;
    const fallbackPattern =
      /([+0]?\d{2,4}[\s().-]?\d{3,4}[\s().-]?\d{3,5}(?:[\s().-]?\d{2,5})?)/;

    const labeledMatch =
      lines
        .map((text) => text.match(labeledPattern)?.[1])
        .find((val) => !!val) || joined.match(labeledPattern)?.[1];
    const raw = labeledMatch ?? joined.match(fallbackPattern)?.[1];

    return raw ? this.normalizePhoneNumber(raw) : undefined;
  }

  private normalizePhoneNumber(raw: string): string | undefined {
    const firstSegment = raw.split(/[/|;]/)[0] || raw;
    const normalized = firstSegment
      .replace(/[^+\d]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const digitsOnly = normalized.replace(/\D/g, '');
    if (digitsOnly.length < 7) return undefined;

    return normalized;
  }

  private formatDate(date: Date): string {
    try {
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    } catch {
      // Fallback to ISO-like without time.
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  private parseDate(input: string): Date | undefined {
    const months: Record<string, number> = {
      jan: 1,
      january: 1,
      januari: 1,
      feb: 2,
      february: 2,
      februari: 2,
      mar: 3,
      march: 3,
      maret: 3,
      apr: 4,
      april: 4,
      may: 5,
      mei: 5,
      jun: 6,
      june: 6,
      juni: 6,
      jul: 7,
      july: 7,
      juli: 7,
      aug: 8,
      august: 8,
      ags: 8,
      agustus: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      okt: 10,
      oktober: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
      des: 12,
      desember: 12,
    };

    const monthName = input.match(
      /(Jan(?:uary|uari)?|Feb(?:ruary|ruari)?|Mar(?:ch|et)?|Apr(?:il)?|May|Mei|Jun(?:e|i)?|Jul(?:y|i)?|Aug(?:ust|ustus|s)?|Sep(?:t)?(?:ember)?|Oct(?:ober|ober)?|Okt(?:ober)?|Nov(?:ember)?|Dec(?:ember|ember)?|Des(?:ember)?)/i,
    );
    if (monthName) {
      const dayMatch = input.match(/(\d{1,2})(?:st|nd|rd|th)?/);
      const yearMatch = input.match(/(\d{4})/);
      const numberParts = input.match(/\d{2,4}/g) ?? [];
      const fallbackYear = numberParts.length
        ? Number(numberParts.at(-1))
        : NaN;
      const month = months[monthName[1].toLowerCase()];
      const day = dayMatch ? Number(dayMatch[1]) : NaN;
      let year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
      if (year < 100 && !Number.isNaN(year)) year += 2000;
      // Use UTC to avoid timezone shifts when serialized.
      const date = new Date(Date.UTC(year, month - 1, day));
      return Number.isNaN(date.getTime()) ? undefined : date;
    }

    const normalized = input.replace(/[-.]/g, '/');
    const parts = normalized.split('/');
    if (parts.length !== 3) return undefined;

    let year = parts[0].length === 4 ? Number(parts[0]) : Number(parts[2]);
    const month = parts[0].length === 4 ? Number(parts[1]) : Number(parts[1]);
    const day = parts[0].length === 4 ? Number(parts[2]) : Number(parts[0]);

    if (year < 100) year += 2000;
    // Use UTC to avoid timezone shifts when serialized.
    const date = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private parseAmount(input: string): Prisma.Decimal | undefined {
    const normalized = input.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(normalized);
    return Number.isFinite(num) ? new Prisma.Decimal(num) : undefined;
  }
}
