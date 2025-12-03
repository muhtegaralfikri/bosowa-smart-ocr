1. Backend: Perbaiki Logika Deteksi Pengirim (ocr.service.ts)
File: apps/backend/src/ocr/ocr.service.ts Tujuan: Mengubah parseMetadata agar pencarian Sender (Pengirim) hanya dilakukan pada 8 baris pertama (Header), bukan seluruh dokumen. Ini untuk membedakan surat internal (Bosowa) vs eksternal.

Instruksi: Ganti method parseMetadata dengan logika berikut:

TypeScript

// Di dalam class OcrService

private parseMetadata(data: OcrItem[]) {
  if (!Array.isArray(data)) return {};

  const sanitize = (text: string) => text.replace(/^\s*[:：]\s*/, '').trim();
  const texts = data.map((item) => sanitize(item?.text ?? '')).filter(Boolean);
  
  // 1. Definisikan Area Header (misal: 8 baris pertama)
  const headerLines = texts.slice(0, 8);
  const headerJoined = headerLines.join(' ');
  const fullJoined = texts.join(' ').replace(/\s+/g, ' ');

  // 2. Logika Cerdas Deteksi Pengirim (Hanya di Header)
  let senderDetected: string | undefined = undefined;
  
  // Cek apakah ini dokumen internal Bosowa (ada kata Bosowa di header)
  if (/bosowa/i.test(headerJoined)) {
    // Jika header ada 'Bosowa', anggap pengirim internal, 
    // atau biarkan kosong jika ingin diisi manual.
    senderDetected = "BOSOWA (Internal)"; 
  } else {
    // Jika tidak ada Bosowa di header, cari nama PT/CV lain di header
    // Regex prioritas untuk menangkap nama perusahaan
    const companyMatch = headerJoined.match(/(?:pt|cv|ud|yayasan)\.?\s+[a-z0-9 .,&-]+/i);
    
    if (companyMatch) {
      senderDetected = companyMatch[0];
    } else {
      // Fallback: Cari pola 'From/Dari' hanya di header
      senderDetected = headerJoined.match(/(?:from|dari)[:\s]+([A-Za-z0-9 .,&-]{3,50})/i)?.[1];
    }
  }

  // --- Logika Parsing Lainnya Tetap Menggunakan fullJoined (untuk tanggal/amount yg mungkin di bawah) ---
  
  const invoiceMatch = fullJoined.match(/(?:invoice\s*(?:no|number|#)?\s*[:-]?\s*)([A-Z0-9/-]{5,})/i) ||
    texts.find((t) => /^inv[-\s]/i.test(t))?.match(/(inv[-\s]?[A-Z0-9/-]+)/i);
    
  const letterMatch = this.extractLetterNo(texts, fullJoined); // Gunakan fullJoined
  
  // Gabungkan logika Letter No (Prioritaskan Invoice jika ada, sesuai request user)
  const finalRefNumber = invoiceMatch?.[1] || letterMatch;

  // ... (Sisa logika ekstraksi date, amount, dll tetap sama) ...

  const type = invoiceMatch
      ? DocType.INVOICE
      : fullJoined.toLowerCase().includes('surat')
        ? DocType.SURAT_RESMI
        : DocType.LAINNYA;

  return {
    invoiceNo: invoiceMatch?.[1],
    letterNo: finalRefNumber, // Simpan di satu field sesuai request
    docDate: this.extractDate(texts, fullJoined) ? this.parseDate(this.extractDate(texts, fullJoined)!) : undefined,
    sender: senderDetected, // Gunakan hasil deteksi header
    subject: texts.find((t) => /(perihal|perkara|subject|hal)[:.\s-]*/i.test(t))?.replace(/^(perihal|perkara|subject|hal)[:.\s-]*/i, '').trim(),
    amount: fullJoined.match(/(?:rp\.?\s*)?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i) ? this.parseAmount(fullJoined.match(/(?:rp\.?\s*)?([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/i)![1]) : undefined,
    type,
    // ... field lain
  } satisfies ParsedFields;
}
Tambahkan juga method helper publik untuk mengambil path file (diperlukan oleh controller nanti):

TypeScript

async getDocumentPath(id: string) {
  return this.prisma.document.findUnique({
    where: { id },
    select: { filePath: true, mimeType: true, fileName: true },
  });
}
2. Backend: Buat Endpoint Secure Image (ocr.controller.ts)
File: apps/backend/src/ocr/ocr.controller.ts Tujuan: Membuat endpoint aman untuk streaming gambar. Jangan pernah membuka folder uploads menjadi publik (static assets).

Instruksi: Tambahkan import dan endpoint berikut:

TypeScript

import { StreamableFile, Res, NotFoundException } from '@nestjs/common'; // Tambah ini
import { Response } from 'express'; // Tambah ini
import { createReadStream } from 'fs'; // Tambah ini
import { join } from 'path'; // Tambah ini
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Pastikan path benar

// Di dalam OcrController

@UseGuards(JwtAuthGuard) // Wajib login untuk lihat gambar
@Get('image/:id')
async serveImage(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
  const doc = await this.ocrService.getDocumentPath(id);
  
  if (!doc) throw new NotFoundException('Dokumen tidak ditemukan');

  const fullPath = join(process.cwd(), doc.filePath);
  
  const file = createReadStream(fullPath);

  res.set({
    'Content-Type': doc.mimeType,
    'Content-Disposition': `inline; filename="${doc.fileName}"`,
  });

  return new StreamableFile(file);
}
3. Frontend: Service untuk Fetch Image (documentService.ts)
File: apps/frontend/src/services/documentService.ts Tujuan: Mengambil gambar sebagai Blob dari endpoint aman menggunakan token Auth.

Instruksi: Tambahkan method ini:

TypeScript

// Pastikan axios instance yang dipakai sudah memiliki Interceptor untuk menyisipkan Bearer Token
import api from './api'; // Sesuaikan dengan axios instance Anda

export const getDocumentImage = async (id: string): Promise<string> => {
  const response = await api.get(`/ocr/image/${id}`, {
    responseType: 'blob', // Penting agar dibaca sebagai file
  });
  
  // Buat URL objek lokal dari blob
  return URL.createObjectURL(response.data);
};
4. Frontend: UI Tombol "Lihat Gambar" (ResultForm.tsx)
File: apps/frontend/src/components/ResultForm.tsx (atau komponen List dokumen Anda) Tujuan: Menambahkan tombol di sebelah hasil pencarian/form untuk melihat gambar asli.

Instruksi: Tambahkan handler dan tombol:

TypeScript

import { getDocumentImage } from '../services/documentService';

// Di dalam component
const handleViewImage = async (docId: string) => {
  try {
    const imageUrl = await getDocumentImage(docId);
    // Buka di tab baru
    window.open(imageUrl, '_blank');
  } catch (error) {
    alert('Gagal memuat gambar. Pastikan Anda login.');
  }
};

// Di bagian JSX (Render tombol di sebelah Save/Delete)
<button
  type="button"
  onClick={() => handleViewImage(data.id)} // Asumsikan 'data.id' tersedia
  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 ml-2"
>
  Lihat Gambar Asli
</button>
Catatan untuk Anda (User): Instruksi di atas sudah mencakup "pengaman" logika.

Backend dipaksa memotong array teks (slice(0, 8)) sebelum menebak pengirim. Ini akan mencegah footer surat (alamat kantor cabang dll) terbaca sebagai pengirim.

Keamanan terjaga karena gambar tidak bisa diakses lewat URL langsung (seperti domain.com/uploads/foto.jpg), melainkan harus lewat API yang mengecek Token Login.