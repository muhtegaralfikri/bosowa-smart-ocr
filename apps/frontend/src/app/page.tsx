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
import { searchDocuments, type DocumentItem, getDocumentImage } from '../services/documentService';

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
  const [openingImage, setOpeningImage] = useState<string | null>(null);

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

  const handleOpenDocumentImage = async (id: string) => {
    if (!token) {
      setError('Harap login untuk melihat gambar dokumen.');
      return;
    }
    try {
      setOpeningImage(id);
      const url = await getDocumentImage(id, token);
      const tab = window.open(url, '_blank');
      if (!tab) {
        alert('Pop-up diblokir. Izinkan pop-up untuk melihat gambar.');
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memuat gambar';
      setError(message);
    } finally {
      setOpeningImage(null);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.08),transparent_20%)]">
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-10 flex flex-col gap-8">
        <header className="flex flex-col gap-5 bg-white/70 backdrop-blur-md border border-white/60 shadow-sm rounded-2xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-emerald-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
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

          <div className="grid gap-4 md:grid-cols-[2fr,1fr] items-center">
            <div className="space-y-3">
              <h1 className="text-3xl md:text-4xl font-semibold text-ink leading-tight">
                Digitize invoices with precision.
                <span className="text-primary"> Crop. Extract. Edit.</span>
              </h1>
              <p className="text-base md:text-lg text-ink/70 max-w-3xl">
                Unggah dokumen, pilih area penting, lalu biarkan mesin OCR mem-parsing data.
                Kurasi hasilnya sebelum disimpan ke basis data Anda.
              </p>
              <div className="flex gap-2 text-xs text-ink/60">
                <span className="px-3 py-1 rounded-full bg-ink/5 border border-ink/10">Multi-role ready</span>
                <span className="px-3 py-1 rounded-full bg-ink/5 border border-ink/10">Direct to DB</span>
                <span className="px-3 py-1 rounded-full bg-ink/5 border border-ink/10">Auditable changes</span>
              </div>
            </div>
            <div className="hidden md:flex justify-end">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-ink/5 via-white to-white border border-ink/10 shadow-sm w-full max-w-sm">
                <p className="text-xs font-semibold text-ink/70 mb-2">Status alur</p>
                <div className="space-y-2 text-sm text-ink">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Unggah atau ambil foto
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    Crop & kirim ke engine OCR
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    Review dan simpan
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

      {error && (
        <div className="field-card p-4 bg-red-50 border-red-200 text-red-700">
          {error}
        </div>
      )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr] items-start">
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
            <div className="field-card p-5 bg-white/80 backdrop-blur-md border border-ink/10 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-ink">Unggah atau ambil foto</h3>
                <span className="text-xs text-ink/60">{processing ? 'Memproses…' : 'Siap digunakan'}</span>
              </div>
              <ImageUpload
                onFileSelected={handleFileSelected}
                disabled={processing}
                onUseCamera={() => setShowCamera(true)}
              />
            </div>

          {previewUrl && (
              <div className="field-card p-4 flex gap-4 items-center bg-white/80 backdrop-blur-md border border-ink/10 shadow-sm">
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

        <div className="lg:col-span-1 flex flex-col gap-4 lg:sticky lg:top-4 self-start">
            <div className="field-card p-4 bg-white/85 backdrop-blur-md border border-ink/10 shadow-sm lg:max-h-[520px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-semibold text-ink">Detected fields</h4>
              <span className="text-xs text-ink/50">Auto-filled</span>
            </div>
            {detected ? (
              <div className="grid gap-3 text-sm md:grid-cols-2 max-h-[500px] overflow-auto pr-1">
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-ink/70">Invoice No</label>
                  <input
                    type="text"
                    value={detected.invoiceNo ?? ''}
                    onChange={(e) => setDetected({ ...detected, invoiceNo: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-ink/70">Letter No</label>
                  <input
                    type="text"
                    value={detected.letterNo ?? ''}
                    onChange={(e) => setDetected({ ...detected, letterNo: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-ink/70">Date</label>
                  <input
                    type="text"
                    value={detected.docDate ?? ''}
                    onChange={(e) => setDetected({ ...detected, docDate: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-ink/70">Amount</label>
                  <input
                    type="text"
                    value={detected.amount?.toString() ?? ''}
                    onChange={(e) => setDetected({ ...detected, amount: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-ink/70">Sender</label>
                  <input
                    type="text"
                    value={detected.sender ?? ''}
                    onChange={(e) => setDetected({ ...detected, sender: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-ink/70">Email</label>
                  <input
                    type="text"
                    value={detected.email ?? ''}
                    onChange={(e) => setDetected({ ...detected, email: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-1">
                  <label className="text-xs font-semibold text-ink/70">Phone</label>
                  <input
                    type="text"
                    value={detected.phone ?? ''}
                    onChange={(e) => setDetected({ ...detected, phone: e.target.value })}
                    className="w-full border border-ink/10 rounded-lg px-3 py-2 mt-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="md:col-span-2">
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
            <div className="field-card p-4 bg-white/85 backdrop-blur-md border border-ink/10 shadow-sm">
              <ResultForm
                items={results}
                onChange={setResults}
                documentId={documentId}
                token={token}
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="button-primary px-6"
                  onClick={handleSave}
                  disabled={!documentId || !token}
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
            <div className="field-card p-4 bg-white/85 backdrop-blur-md border border-ink/10 shadow-sm">
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
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleOpenDocumentImage(doc.id)}
                    className="w-full text-left border border-ink/5 rounded-lg p-3 hover:border-primary/40 transition-colors"
                    disabled={openingImage === doc.id}
                  >
                    <p className="text-sm font-semibold text-ink flex items-center justify-between">
                      {doc.invoiceNo || doc.letterNo || doc.fileName}
                      {openingImage === doc.id && (
                        <span className="text-[11px] text-ink/60">Membuka…</span>
                      )}
                    </p>
                    <p className="text-xs text-ink/60">Tipe: {doc.type} · Status: {doc.status}</p>
                    <p className="text-xs text-ink/60">
                      Invoice: {doc.invoiceNo || '-'} | Surat: {doc.letterNo || '-'}
                    </p>
                    <p className="text-xs text-ink/50">Diunggah: {new Date(doc.createdAt).toLocaleString()}</p>
                  </button>
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
      </div>
    </main>
  );
}
