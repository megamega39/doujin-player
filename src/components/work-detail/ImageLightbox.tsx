import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ImageLightboxProps {
  images: string[];
  initialIndex: number;
  title: string;
  onClose: () => void;
  onThumbnailSet?: (imagePath: string) => void | Promise<void>;
}

export function ImageLightbox({
  images,
  initialIndex,
  title,
  onClose,
  onThumbnailSet,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, images.length - 1))
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const currentPath = images[currentIndex];
  const canNavigate = images.length > 1;

  const goPrev = () => {
    if (!canNavigate) return;
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  };
  const goNext = () => {
    if (!canNavigate) return;
    setCurrentIndex((i) => (i + 1) % images.length);
  };

  useEffect(() => {
    function handleClick() {
      setContextMenu(null);
    }
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    const len = images.length;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && len > 1) {
        setCurrentIndex((i) => (i - 1 + len) % len);
      }
      if (e.key === 'ArrowRight' && len > 1) {
        setCurrentIndex((i) => (i + 1) % len);
      }
    }
    function handleWheel(e: WheelEvent) {
      if (len <= 1) return;
      e.preventDefault();
      if (e.deltaY > 0) {
        setCurrentIndex((i) => (i + 1) % len);
      } else if (e.deltaY < 0) {
        setCurrentIndex((i) => (i - 1 + len) % len);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      document.body.style.overflow = '';
    };
  }, [onClose, images.length]);

  if (!currentPath) return null;

  const imgSrc = convertFileSrc(currentPath);
  const fileName = currentPath.split(/[/\\]/).pop() || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={(e) => {
        // 背景（自分自身）をクリックした場合のみ閉じる
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex items-center justify-center w-full h-full"
        onClick={(e) => {
          // この div 自身（画像やボタンの外側の余白）クリックで閉じる
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {canNavigate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-dark-card/80 hover:bg-dark-hover text-white z-10"
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div className="flex flex-col items-center gap-4 px-4">
          <img
            key={currentPath}
            src={imgSrc}
            alt={fileName || title}
            className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg shadow-2xl cursor-pointer"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onContextMenu={(e) => {
              if (onThumbnailSet) {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY });
              }
            }}
            style={{ maxWidth: 'min(90vw, 1200px)', maxHeight: '85vh' }}
          />
          {contextMenu && onThumbnailSet && (
            <div
              className="fixed z-[60] min-w-[180px] py-1 bg-dark-card border border-dark-border rounded-lg shadow-xl"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={async () => {
                  await onThumbnailSet(currentPath);
                  setContextMenu(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-dark-hover flex items-center gap-2"
              >
                <ImageIcon size={16} />
                この画像をサムネにする
              </button>
            </div>
          )}
          <p className="text-sm text-gray-400 text-center px-4 truncate max-w-xl">
            {fileName}
          </p>
          {images.length > 1 && (
            <p className="text-xs text-gray-400">
              {currentIndex + 1} / {images.length}
            </p>
          )}
        </div>

        {canNavigate && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-dark-card/80 hover:bg-dark-hover text-white z-10"
          >
            <ChevronRight size={32} />
          </button>
        )}

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-dark-card/80 hover:bg-dark-hover text-white z-10"
        >
          <X size={24} />
        </button>
      </div>
    </div>
  );
}
