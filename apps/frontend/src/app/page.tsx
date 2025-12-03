'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ImageCropper from '../components/ImageCropper';
import ImageUpload from '../components/ImageUpload';
import ResultForm from '../components/ResultForm';
import CameraCapture from '../components/CameraCapture';
import type { OcrItem } from '../services/ocrService';
import { submitCroppedImage } from '../services/ocrService';
import { searchDocuments, type DocumentItem } from '../services/documentService';

export default function HomePage() {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<OcrItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [searchInvoice, setSearchInvoice] = useState('');
  const [searchLetter, setSearchLetter] = useState('');
  const [searchResults, setSearchResults] = useState<DocumentItem[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('accessToken');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => {
      URL.revokeObjectURL(previewUrl);
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
    if (!token) {
      setError('Harap login terlebih dahulu untuk mengirim OCR.');
      return;
    }

    setProcessing(true);
    setShowCropper(false);
    setPreviewUrl(cropPreview);

    try {
      const response = await submitCroppedImage(blob, token);
      setResults(response.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      setError(message);
    } finally {
      setProcessing(false);
    }
  };

  const handleSearch = async () => {
    if (!token) {
      setError('Harap login terlebih dahulu untuk mencari dokumen.');
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const data = await searchDocuments({
        invoiceNo: searchInvoice || undefined,
        letterNo: searchLetter || undefined,
      }, token);
      setSearchResults(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search';
      setError(message);
    } finally {
      setSearching(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('accessToken');
  };

  return (
    <main className="max-w-6xl mx-auto px-4 py-12 flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold">
              B
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink/60">Bosowa Smart OCR</p>
              <p className="text-sm text-ink/70">Crop · Extract · Edit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {token ? (
              <button type="button" className="button-ghost" onClick={handleLogout}>
                Logout
              </button>
            ) : (
              <Link href="/auth" className="button-primary">
                Login / Register
              </Link>
            )}
          </div>
        </div>

        <h1 className="text-4xl md:text-5xl font-semibold text-ink leading-tight">
          Digitize invoices with precision.
          <span className="text-primary"> Crop. Extract. Edit.</span>
        </h1>
        <p className="text-lg text-ink/70 max-w-3xl">
          Upload a document, crop the meaningful area, and let the backend orchestrator talk to the Python engine. Tweak the extracted text before saving.
        </p>
      </header>

      {error && (
        <div className="field-card p-4 bg-red-50 border-red-200 text-red-700">
          {error}
        </div>
      )}

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

          <div className="field-card p-4 bg-white">
            <h4 className="text-base font-semibold text-ink mb-3">Cari dokumen</h4>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs font-semibold text-ink/70">Nomor Invoice</label>
                <input
                  type="text"
                  value={searchInvoice}
                  onChange={(e) => setSearchInvoice(e.target.value)}
                  className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="INV/2024/001"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-ink/70">Nomor Surat</label>
                <input
                  type="text"
                  value={searchLetter}
                  onChange={(e) => setSearchLetter(e.target.value)}
                  className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="SURAT/2024/ABC"
                />
              </div>
              <button
                type="button"
                className="button-primary w-full"
                onClick={handleSearch}
                disabled={searching}
              >
                {searching ? 'Mencari…' : 'Cari'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-3">
                {searchResults.map((doc) => (
                  <div key={doc.id} className="border border-ink/5 rounded-lg p-3">
                    <p className="text-sm font-semibold text-ink">
                      {doc.invoiceNo || doc.letterNo || doc.fileName}
                    </p>
                    <p className="text-xs text-ink/60">Tipe: {doc.type} · Status: {doc.status}</p>
                    <p className="text-xs text-ink/60">
                      Invoice: {doc.invoiceNo || '-'} | Surat: {doc.letterNo || '-'}
                    </p>
                    <p className="text-xs text-ink/50">Diunggah: {new Date(doc.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
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
