'use client';

import { useCallback, useRef, useState } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';

interface ImageCropperProps {
  src: string;
  onCancel: () => void;
  onConfirm: (blob: Blob, previewUrl: string) => void;
  loading?: boolean;
}

function toCroppedBlob(image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width * scaleX;
  canvas.height = crop.height * scaleY;
  const ctx = canvas.getContext('2d');

  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width * scaleX,
    crop.height * scaleY,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to crop image'));
      }
    }, 'image/jpeg', 0.95);
  });
}

export default function ImageCropper({ src, onCancel, onConfirm, loading }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!completedCrop || !imageRef.current) return;
    const blob = await toCroppedBlob(imageRef.current, completedCrop);
    if (blob) {
      const previewUrl = URL.createObjectURL(blob);
      onConfirm(blob, previewUrl);
    }
  }, [completedCrop, onConfirm]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl shadow-ink/20 max-w-4xl w-full p-6 relative overflow-hidden">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink/50">Step 2</p>
            <h3 className="text-2xl font-semibold text-ink">Crop the important area</h3>
            <p className="text-sm text-ink/60 mt-1">Focus on text regions to boost OCR accuracy.</p>
          </div>
          <button type="button" className="button-ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
        </div>

        <div className="relative w-full max-h-[70vh] bg-ink/5 rounded-xl overflow-auto flex items-center justify-center">
          <ReactCrop
            crop={crop}
            onChange={(value) => setCrop(value)}
            onComplete={(c) => setCompletedCrop(c as PixelCrop)}
            minWidth={100}
            minHeight={100}
            className="max-h-[70vh]"
          >
            <img
              src={src}
              alt="To be cropped"
              className="max-h-[70vh] w-auto object-contain"
              onLoad={(event) => {
                const img = event.currentTarget as HTMLImageElement;
                imageRef.current = img;
                setCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
              }}
            />
          </ReactCrop>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="button-ghost" onClick={onCancel} disabled={loading}>
            Back
          </button>
          <button type="button" className="button-primary" onClick={handleConfirm} disabled={!completedCrop || loading}>
            {loading ? 'Processing…' : 'Use this crop'}
          </button>
        </div>
      </div>
    </div>
  );
}
