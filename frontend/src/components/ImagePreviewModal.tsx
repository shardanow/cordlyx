'use client';

import { useEffect, useCallback } from 'react';

interface ImagePreviewModalProps {
  src: string;
  onClose: () => void;
}

export default function ImagePreviewModal({ src, onClose }: ImagePreviewModalProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt="Preview"
          className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
        />
        <div className="absolute top-2 right-2 flex gap-2">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-black/50 text-white px-3 py-1.5 rounded text-xs hover:bg-black/70 transition"
          >
            Download
          </a>
          <button
      onPointerDown={onClose}
            className="bg-black/50 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-black/70 transition text-lg"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
