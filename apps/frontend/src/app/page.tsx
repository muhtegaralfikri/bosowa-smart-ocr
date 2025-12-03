'use client';

import { useEffect, useState } from 'react';
import ImageCropper from '../components/ImageCropper';
import ImageUpload from '../components/ImageUpload';
import ResultForm from '../components/ResultForm';
import CameraCapture from '../components/CameraCapture';
import type { OcrItem } from '../services/ocrService';
import { submitCroppedImage } from '../services/ocrService';

export default function HomePage() {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<OcrItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedSrc(reader.result as string);
      setShowCropper(true);
      setError(null);
      setResults([]);
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (file: File, preview: string) => {
    setShowCamera(false);
    setSelectedSrc(preview);
    // Reuse the same flow as file upload
    handleFileSelected(file);
  };

  const handleCropConfirm = async (blob: Blob, cropPreview: string) => {
    setProcessing(true);
    setShowCropper(false);
    setPreviewUrl(cropPreview);

    try {
      const response = await submitCroppedImage(blob);
      setResults(response.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <p className="text-sm uppercase tracking-[0.25em] text-ink/60">Bosowa Smart OCR</p>
        <h1 className="text-4xl md:text-5xl font-semibold text-ink leading-tight">
          Digitize invoices with precision.
          <span className="text-primary"> Crop. Extract. Edit.</span>
        </h1>
        <p className="text-lg text-ink/70 max-w-3xl">
          Upload a document, crop the meaningful area, and let the backend orchestrator talk to the Python engine. Tweak the extracted text before saving.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <ImageUpload
            onFileSelected={handleFileSelected}
            disabled={processing}
            onUseCamera={() => setShowCamera(true)}
          />

          {previewUrl && (
            <div className="field-card p-4 flex gap-4 items-center bg-white">
              <div className="w-32 h-32 bg-ink/5 rounded-lg overflow-hidden flex items-center justify-center border border-ink/10">
                <img src={previewUrl} alt="Cropped preview" className="h-full w-full object-contain" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-ink/60">Cropped image ready.</p>
                <p className="text-base font-semibold text-ink">{processing ? 'Sending to backend…' : 'Ready to extract text.'}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="field-card p-4 bg-red-50 border-red-200 text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="lg:col-span-1 flex flex-col gap-4">
          <ResultForm items={results} />
          <div className="field-card p-4 text-sm text-ink/70 bg-white">
            <h4 className="text-base font-semibold text-ink mb-2">How it works</h4>
            <ul className="list-disc list-inside space-y-2">
              <li>Frontend sends the cropped image to NestJS at <code className="px-1 py-0.5 bg-ink/5 rounded">/ocr/scan</code>.</li>
              <li>NestJS proxies the file to the FastAPI PaddleOCR engine on port 8000.</li>
              <li>Returned text is shown here for quick review and edits.</li>
            </ul>
          </div>
        </div>
      </div>

      {showCropper && selectedSrc && (
        <ImageCropper
          src={selectedSrc}
          onCancel={() => setShowCropper(false)}
          onConfirm={handleCropConfirm}
          loading={processing}
        />
      )}

      {showCamera && (
        <CameraCapture
          onCancel={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </main>
  );
}
