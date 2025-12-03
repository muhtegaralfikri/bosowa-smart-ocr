export interface OcrItem {
  text: string;
  confidence: number;
}

export interface ExtractedFields {
  invoiceNo?: string;
  letterNo?: string;
  docDate?: string;
  sender?: string;
  amount?: string | number;
  address?: string;
  email?: string;
  phone?: string;
  type?: string;
}

export interface OcrResponse {
  status: string;
  data: OcrItem[];
  extracted?: ExtractedFields;
  documentId?: string;
}

export interface UpdateDocumentPayload {
  invoiceNo?: string;
  letterNo?: string;
  docDate?: string;
  sender?: string;
  amount?: string | number;
  rawOcr?: unknown;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export async function submitCroppedImage(file: Blob, token: string): Promise<OcrResponse> {
  if (!token) {
    throw new Error('Token tidak ditemukan. Silakan login terlebih dahulu.');
  }

  const formData = new FormData();
  formData.append('file', file, 'crop.jpg');

  const response = await fetch(`${BASE_URL}/ocr/scan`, {
    method: 'POST',
    body: formData,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to reach backend OCR endpoint');
  }

  return (await response.json()) as OcrResponse;
}

export async function updateDocument(
  id: string,
  payload: UpdateDocumentPayload,
  token: string,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/ocr/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Gagal menyimpan perubahan dokumen');
  }
}
