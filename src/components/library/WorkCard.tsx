import { memo, useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { api } from '../../api';
import { useTranslation } from '../../i18n';
import { getCachedThumbnail, setCachedThumbnail } from '../../utils/thumbnailCache';
import type { Work } from '../../api';

interface WorkCardProps {
  work: Work;
  onToggleFavorite: (workId: string) => void;
  onContextMenu?: (e: React.MouseEvent, work: Work) => void;
  priority?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (workId: string) => void;
}

export const WorkCard = memo(function WorkCard({
  work,
  onToggleFavorite,
  onContextMenu,
  priority = false,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: WorkCardProps) {
  const { t } = useTranslation();
  const [thumbSrc, setThumbSrc] = useState<string | null>(() => {
    if (!work.thumbnail_path) return null;
    return getCachedThumbnail(work.thumbnail_path) ?? null;
  });
  const [loaded, setLoaded] = useState(!!thumbSrc);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const folderName = work.folder_path.split(/[/\\]/).pop() ?? work.title;

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const check = () => setIsTruncated(el.scrollWidth > el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [work.title, work.folder_path]);

  useEffect(() => {
    if (!work.thumbnail_path) return;
    const cached = getCachedThumbnail(work.thumbnail_path);
    if (cached) {
      setThumbSrc(cached);
      setLoaded(true);
      return;
    }
    api
      .getThumbnailPath(work.thumbnail_path)
      .then((filePath) => {
        const assetUrl = convertFileSrc(filePath);
        setCachedThumbnail(work.thumbnail_path!, assetUrl);
        setThumbSrc(assetUrl);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [work.thumbnail_path]);

  const showPlaceholder = !work.thumbnail_path || !thumbSrc;

  const cardContent = (
    <>
      <div className="aspect-square bg-dark-hover relative overflow-hidden">
        {thumbSrc && (
          <img
            src={thumbSrc}
            alt=""
            className={`w-full h-full object-cover transition-opacity duration-150 ${loaded ? 'opacity-100' : 'opacity-0'
              }`}
            loading={priority ? 'eager' : 'lazy'}
          />
        )}
        {showPlaceholder && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-4xl">
            ♪
          </div>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleFavorite(work.id);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full transition-opacity z-10 ${work.is_favorite ? 'text-red-500' : 'text-gray-400 hover:text-gray-300'
            }`}
        >
          <Heart
            size={20}
            fill={work.is_favorite ? 'currentColor' : 'none'}
          />
        </button>
      </div>
      <div className="p-3">
        <h3
          ref={titleRef}
          className="font-medium truncate group-hover:text-accent transition-colors"
        >
          {work.title}
        </h3>
        <p className="text-sm text-gray-400 mt-0.5">
          {t('library.tracks', { count: work.track_count })}
        </p>
      </div>
    </>
  );

  if (selectMode) {
    return (
      <div
        onClick={() => onToggleSelect?.(work.id)}
        className={`block relative bg-dark-card rounded-lg overflow-hidden border-2 transition-colors group cursor-pointer ${
          selected ? 'border-accent' : 'border-dark-border hover:border-accent/50'
        }`}
        title={isTruncated ? folderName : undefined}
      >
        {/* 選択チェックマーク */}
        {selected && (
          <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded bg-accent flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      to={`/work/${work.id}`}
      className="block bg-dark-card rounded-lg overflow-hidden border border-dark-border hover:border-accent/50 transition-colors group"
      title={isTruncated ? folderName : undefined}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e, work);
      }}
    >
      {cardContent}
    </Link>
  );
});
