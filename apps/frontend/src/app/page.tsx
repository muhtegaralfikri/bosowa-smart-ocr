'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ImageCropper from '../components/ImageCropper';
import ImageUpload from '../components/ImageUpload';
import ResultForm from '../components/ResultForm';
import CameraCapture from '../components/CameraCapture';
import type {
  ExtractedFields,
  OcrItem,
  UpdateDocumentPayload,
} from '../services/ocrService';
import { submitCroppedImage, updateDocument } from '../services/ocrService';
import { searchDocuments, type DocumentItem } from '../services/documentService';

export default function HomePage() {
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [results, setResults] = useState<OcrItem[]>([]);
  const [detected, setDetected] = useState<ExtractedFields | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
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
      setDetected(null);
      setDocumentId(null);
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
      setDetected(response.extracted ?? null);
      setDocumentId(response.documentId ?? null);
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

  const handleSave = async () => {
    if (!token || !documentId) {
      setError('Tidak ada dokumen untuk disimpan.');
      return;
    }

    const payload: UpdateDocumentPayload = {
      invoiceNo: detected?.invoiceNo,
      letterNo: detected?.letterNo,
      docDate: detected?.docDate,
      sender: detected?.sender,
      amount: detected?.amount,
      rawOcr: results,
    };

    try {
      await updateDocument(documentId, payload, token);
      alert('Perubahan berhasil disimpan.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal menyimpan perubahan';
      setError(message);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('accessToken');
  };

  return (
    <main className="w-full max-w-6xl mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-white flex items-center justify-center font-bold">
              B
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink/60">Bosowa Smart OCR</p>
              <p className="text-xs text-ink/70">Crop · Extract · Edit</p>
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

        <h1 className="text-3xl md:text-4xl font-semibold text-ink leading-tight">
          Digitize invoices with precision.
          <span className="text-primary"> Crop. Extract. Edit.</span>
        </h1>
        <p className="text-base md:text-lg text-ink/70 max-w-3xl">
          Upload a document, crop the meaningful area, and let the backend orchestrator talk to the Python engine. Tweak the extracted text before saving.
        </p>
      </header>

      {error && (
        <div className="field-card p-4 bg-red-50 border-red-200 text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
        <div className="flex flex-col gap-4">
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

        <div className="lg:col-span-1 flex flex-col gap-4 lg:sticky lg:top-6 self-start">
          <div className="field-card p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-semibold text-ink">Detected fields</h4>
              <span className="text-xs text-ink/50">Auto-filled</span>
            </div>
            {detected ? (
              <div className="grid gap-3 text-sm">
                <div>
                  <label className="text-xs font-semibold text-ink/70">Invoice No</label>
                  <input
                    type="text"
                    value={detected.invoiceNo ?? ''}
                    onChange={(e) => setDetected({ ...detected, invoiceNo: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/70">Letter No</label>
                  <input
                    type="text"
                    value={detected.letterNo ?? ''}
                    onChange={(e) => setDetected({ ...detected, letterNo: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink/70">Date</label>
                    <input
                      type="text"
                      value={detected.docDate ?? ''}
                      onChange={(e) => setDetected({ ...detected, docDate: e.target.value })}
                      className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink/70">Amount</label>
                    <input
                      type="text"
                      value={detected.amount?.toString() ?? ''}
                      onChange={(e) => setDetected({ ...detected, amount: e.target.value })}
                      className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/70">Sender</label>
                  <input
                    type="text"
                    value={detected.sender ?? ''}
                    onChange={(e) => setDetected({ ...detected, sender: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-ink/70">Email</label>
                    <input
                      type="text"
                      value={detected.email ?? ''}
                      onChange={(e) => setDetected({ ...detected, email: e.target.value })}
                      className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-ink/70">Phone</label>
                    <input
                      type="text"
                      value={detected.phone ?? ''}
                      onChange={(e) => setDetected({ ...detected, phone: e.target.value })}
                      className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink/70">Address</label>
                  <textarea
                    value={detected.address ?? ''}
                    onChange={(e) => setDetected({ ...detected, address: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    rows={2}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink/60">Upload dan crop untuk melihat hasil deteksi otomatis.</p>
            )}
          </div>
          <div className="field-card p-4 bg-white">
            <div className="flex flex-col gap-3">
              <ResultForm items={results} onChange={setResults} />
              <button
                type="button"
                className="button-primary self-end px-6"
                onClick={handleSave}
                disabled={!documentId || !token}
              >
                Simpan Perubahan
              </button>
            </div>
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
