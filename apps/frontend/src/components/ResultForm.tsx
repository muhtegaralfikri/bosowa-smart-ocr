'use client';

import { useEffect, useState } from 'react';
import type { OcrItem } from '../services/ocrService';

interface ResultFormProps {
  items: OcrItem[];
}

export default function ResultForm({ items }: ResultFormProps) {
  const sanitizeText = (text: string) => text.replace(/^\s*[:：]\s*/, '');
  const [values, setValues] = useState<OcrItem[]>(
    items.map((item) => ({ ...item, text: sanitizeText(item.text) })),
  );

  useEffect(() => {
    setValues(items.map((item) => ({ ...item, text: sanitizeText(item.text) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (!values.length) {
    return (
      <div className="field-card p-6 text-ink/60 text-sm">Processed text will appear here once OCR completes.</div>
    );
  }

  const grouped = [
    { title: 'Header', range: [0, 5] },
    { title: 'Body', range: [5, 15] },
    { title: 'Footer', range: [15, values.length] },
  ];

  return (
    <div className="field-card p-6 bg-white">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/50 mb-3">Step 3</p>
      <h3 className="text-xl font-semibold text-ink mb-4">Review and adjust extracted text</h3>
      <div className="grid gap-4">
        {grouped.map(({ title, range }) => {
          const slice = values.slice(range[0], range[1]);
          if (!slice.length) return null;
          return (
            <div key={title} className="border border-ink/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-ink">{title}</h4>
                <span className="text-xs text-ink/50">
                  Lines {range[0] + 1}–{range[0] + slice.length}
                </span>
              </div>
              <div className="grid gap-3 max-h-[28vh] overflow-y-auto pr-1">
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
