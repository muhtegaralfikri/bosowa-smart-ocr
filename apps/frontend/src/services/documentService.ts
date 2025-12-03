export interface DocumentItem {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  type: string;
  status: string;
  invoiceNo?: string | null;
  letterNo?: string | null;
  docDate?: string | null;
  sender?: string | null;
  amount?: string | null;
  createdAt: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';

export async function searchDocuments(params: { invoiceNo?: string; letterNo?: string }) {
  const query = new URLSearchParams();
  if (params.invoiceNo) query.set('invoiceNo', params.invoiceNo);
  if (params.letterNo) query.set('letterNo', params.letterNo);

  const response = await fetch(`${BASE_URL}/ocr/search?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to search documents');
  }
  const data = (await response.json()) as DocumentItem[];
  return data;
}
