import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';

type OcrResponse = unknown;

const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL?.replace(/\/+$/, '') ||
  'http://127.0.0.1:8000';

@Injectable()
export class OcrService {
  constructor(private readonly httpService: HttpService) {}

  async processImage(file: Express.Multer.File): Promise<OcrResponse> {
    try {
      // 1. Siapkan FormData untuk dikirim ke Python
      const formData = new FormData();

      // Masukkan buffer file yang diupload user ke dalam form data
      formData.append('file', file.buffer, file.originalname);

      // 2. Kirim ke Python Service (Port 8000)
      // Gunakan firstValueFrom untuk mengubah Observable (RxJS) jadi Promise
      const response = await firstValueFrom(
        this.httpService.post<OcrResponse>(
          `${PYTHON_SERVICE_URL}/process-ocr`,
          formData,
          {
            headers: {
              ...formData.getHeaders(), // Header penting agar dikenali sebagai multipart
            },
          },
        ),
      );

      // 3. Ambil data JSON dari Python
      const ocrResult: OcrResponse = response.data;

      // TODO: Di sini nanti kita pasang Regex untuk cleaning data
      // Untuk sekarang, kita return mentah-mentah dulu
      return ocrResult;
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
}
