'use client';

import { useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  onCapture: (file: File, previewUrl: string) => void;
  onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Camera access denied';
        setError(message);
      }
    };
    startCamera();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setCapturing(true);
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Tidak bisa membaca video');
      setCapturing(false);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturing(false);
        if (!blob) {
          setError('Gagal mengambil gambar');
          return;
        }
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(blob);
        onCapture(file, previewUrl);
      },
      'image/jpeg',
      0.95,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl shadow-primary/20 max-w-3xl w-full p-6 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary/70">Step 1B</p>
            <h3 className="text-2xl font-semibold text-primary">Ambil foto dengan kamera</h3>
            <p className="text-sm text-ink/60 mt-1">Pastikan dokumen jelas dan tidak blur.</p>
          </div>
          <button type="button" className="button-ghost" onClick={onCancel} disabled={capturing}>
            Tutup
          </button>
        </div>

        <div className="relative w-full aspect-video bg-primary/5 rounded-xl overflow-hidden flex items-center justify-center">
          {error ? (
            <div className="text-red-600 text-sm p-4">{error}</div>
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain" />
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="button-ghost" onClick={onCancel} disabled={capturing}>
            Batal
          </button>
          <button type="button" className="button-primary" onClick={handleCapture} disabled={capturing || !!error}>
            {capturing ? 'Mengambil…' : 'Ambil foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
