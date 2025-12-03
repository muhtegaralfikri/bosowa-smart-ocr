'use client';

import { useEffect, useState } from 'react';
import type { OcrItem } from '../services/ocrService';
import { getDocumentImage } from '../services/documentService';

interface ResultFormProps {
  items: OcrItem[];
  onChange?: (items: OcrItem[]) => void;
  documentId?: string | null;
  token?: string | null;
}

export default function ResultForm({ items, onChange, documentId, token }: ResultFormProps) {
  const sanitizeText = (text: string) => text.replace(/^\s*[:：]\s*/, '');
  const sanitizeItems = (list: OcrItem[]) =>
    list.map((item) => ({ ...item, text: sanitizeText(item.text) }));
  const [values, setValues] = useState<OcrItem[]>(sanitizeItems(items));
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    const sanitized = sanitizeItems(items);
    setValues(sanitized);
    const differs =
      items.length !== sanitized.length ||
      items.some((item, idx) => item.text !== sanitized[idx]?.text);
    if (differs) {
      onChange?.(sanitized);
    }
  }, [items, onChange]);

  if (!values.length) {
    return (
      <div className="field-card p-6 bg-white/85 border border-dashed border-ink/15 text-ink/70 text-sm flex items-start gap-3">
        <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
        <div>
          <p className="font-semibold text-ink">Menunggu hasil OCR</p>
          <p className="text-ink/70 text-sm">
            Processed text will appear here once OCR completes.
          </p>
        </div>
      </div>
    );
  }

  const grouped = [
    { title: 'Header', range: [0, 5] },
    { title: 'Body', range: [5, 15] },
    { title: 'Footer', range: [15, values.length] },
  ];

  const handleViewImage = async () => {
    if (!documentId || !token) {
      alert('Dokumen belum siap atau token hilang. Pastikan Anda sudah login.');
      return;
    }
    try {
      setLoadingImage(true);
      const imageUrl = await getDocumentImage(documentId, token);
      const newWindow = window.open(imageUrl, '_blank');
      // Revoke URL after it is opened to avoid leaks
      setTimeout(() => URL.revokeObjectURL(imageUrl), 30000);
      if (!newWindow) {
        alert('Pop-up diblokir. Izinkan pop-up untuk melihat gambar.');
      }
    } catch (error) {
      console.error(error);
      alert('Gagal memuat gambar. Pastikan Anda login dan dokumen tersedia.');
    } finally {
      setLoadingImage(false);
    }
  };

  return (
    <div className="field-card p-6 bg-white/90 border border-ink/10 shadow-sm flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Step 3</p>
          <h3 className="text-xl font-semibold text-ink">Review and adjust extracted text</h3>
        </div>
        <button
          type="button"
          className="button-ghost text-sm px-3 py-2"
          onClick={handleViewImage}
          disabled={!documentId || !token || loadingImage}
          title={!documentId ? 'Dokumen belum tersedia' : undefined}
        >
          {loadingImage ? 'Memuat…' : 'Lihat Gambar Asli'}
        </button>
      </div>

      <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-1">
        {grouped.map(({ title, range }) => {
          const slice = values.slice(range[0], range[1]);
          if (!slice.length) return null;
          return (
            <div
              key={title}
              className="border border-ink/5 rounded-xl p-4 bg-white flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-ink">{title}</h4>
                <span className="text-xs text-ink/50">
                  Lines {range[0] + 1}–{range[0] + slice.length}
                </span>
              </div>
              <div className="grid gap-3">
                {slice.map((item, idx) => {
                  const index = range[0] + idx;
                  const isLong = item.text.length > 25;
                  const InputTag = isLong ? 'textarea' : 'input';
                  return (
                    <div key={`${item.text}-${index}`} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-ink/80">Line {index + 1}</label>
                        <span className="text-[11px] text-ink/60 bg-ink/5 px-2 py-0.5 rounded-full">
                          {(item.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                      <InputTag
                        value={item.text}
                        onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                          const next = [...values];
                          next[index] = { ...item, text: sanitizeText(event.target.value) };
                          setValues(next);
                          onChange?.(next);
                        }}
                        className="w-full border border-ink/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
                        rows={isLong ? 2 : undefined}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
