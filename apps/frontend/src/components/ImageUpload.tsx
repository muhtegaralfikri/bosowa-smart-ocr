'use client';

import { ChangeEvent } from 'react';

interface ImageUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function ImageUpload({ onFileSelected, disabled }: ImageUploadProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelected(file);
      event.target.value = '';
    }
  };

  return (
    <div className="field-card p-6 flex flex-col gap-4 gradient-card">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-ink/60 mb-2">Step 1</p>
        <h2 className="text-2xl font-semibold text-ink">Upload your document</h2>
        <p className="text-sm text-ink/70 mt-1">
          Choose a clear photo or scan of your invoice/letter. You can refine the area in the next step.
        </p>
      </div>
      <label className="flex flex-col items-center justify-center border-2 border-dashed border-ink/10 rounded-xl p-6 cursor-pointer bg-white hover:border-ink/30 transition">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        <div className="text-center">
          <p className="text-lg font-medium text-ink">Drop an image or click to browse</p>
          <p className="text-sm text-ink/60 mt-1">PNG, JPG up to 10MB</p>
          <button type="button" className="button-primary mt-4" disabled={disabled}>
            Select image
          </button>
        </div>
      </label>
    </div>
  );
}
