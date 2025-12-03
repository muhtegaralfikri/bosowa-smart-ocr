'use client';

import { useEffect, useState } from 'react';
import type { OcrItem } from '../services/ocrService';

interface ResultFormProps {
  items: OcrItem[];
}

export default function ResultForm({ items }: ResultFormProps) {
  const [values, setValues] = useState<OcrItem[]>(items);

  useEffect(() => {
    setValues(items);
  }, [items]);

  if (!values.length) {
    return (
      <div className="field-card p-6 text-ink/60 text-sm">Processed text will appear here once OCR completes.</div>
    );
  }

  return (
    <div className="field-card p-6 bg-white">
      <p className="text-xs uppercase tracking-[0.2em] text-ink/50 mb-3">Step 3</p>
      <h3 className="text-xl font-semibold text-ink mb-4">Review and adjust extracted text</h3>
      <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
        {values.map((item, index) => (
          <div key={`${item.text}-${index}`} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-ink/80">Line {index + 1}</label>
            <input
              type="text"
              value={item.text}
              onChange={(event) => {
                const next = [...values];
                next[index] = { ...item, text: event.target.value };
                setValues(next);
              }}
              className="w-full border border-ink/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal/40"
            />
            <p className="text-xs text-ink/50">Confidence: {(item.confidence * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
