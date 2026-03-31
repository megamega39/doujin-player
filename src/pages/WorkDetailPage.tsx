import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { openPath } from '@tauri-apps/plugin-opener';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, Heart, AlertTriangle, ImagePlus } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { api, type WorkDetail, type AudioVariant, type Track } from '../api';
import { useTranslation } from '../i18n';
import { VariantSelector } from '../components/work-detail/VariantSelector';
import { WorkEntityEditor } from '../components/work-detail/WorkEntityEditor';
import { TrackList } from '../components/work-detail/TrackList';
import { LoopSegmentList } from '../components/work-detail/LoopSegmentList';
import { ImageLightbox } from '../components/work-detail/ImageLightbox';
import { WorkCardContextMenu } from '../components/library/WorkCardContextMenu';

export function WorkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<WorkDetail | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<AudioVariant | null>(
    null
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxInitialIndex, setLightboxInitialIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(
    null
  );
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const { t } = useTranslation();

  const handleOpenFolder = useCallback(async () => {
    if (!detail?.work.folder_path) return;
    try {
      await openPath(detail.work.folder_path);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }, [detail?.work.folder_path]);

  const handleRescan = useCallback(async () => {
    try {
      await api.rescanLibrary();
      if (id) {
        const d = await api.getWorkDetail(id);
        if (d) setDetail(d);
      }
    } catch (err) {
      console.error('Failed to rescan:', err);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.getWorkDetail(id).then((d) => {
      setDetail(d || null);
      if (d) {
        const defaultV = d.variants.find((v) => v.is_default) ?? d.variants[0];
        setSelectedVariant(defaultV ?? null);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!selectedVariant) return;
    api.getTracks(selectedVariant.id).then(setTracks);
    api.checkTracksExist(selectedVariant.id).then((statuses) => {
      setMissingFiles(
        statuses.filter((s) => !s.exists).map((s) => s.file_path)
      );
    }).catch(console.error);
  }, [selectedVariant?.id]);

  useEffect(() => {
    if (!detail) return;
    const defaultV =
      detail.variants.find((v) => v.is_default) ?? detail.variants[0];
    if (defaultV && !selectedVariant) {
      setSelectedVariant(defaultV);
    }
  }, [detail]);

  if (!detail) {
    return (
      <div className="w-full max-w-[1100px] mx-auto px-6 py-6 text-gray-400">
        {t('loading')}
      </div>
    );
  }

  const { work, variants } = detail;
  const thumbSrc = work.thumbnail_path
    ? convertFileSrc(work.thumbnail_path)
    : null;

  return (
    <div
      className="w-full px-6 py-6"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {contextMenu && (
        <WorkCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpenFolder={handleOpenFolder}
          onRescan={handleRescan}
        />
      )}
      <div className="max-w-[1100px] mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-inherit mb-6"
        >
          <ArrowLeft size={20} />
          {t('workDetail.back')}
        </button>

        <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 mb-8">
          <div className="flex-shrink-0">
            <div
              className={`w-full sm:w-52 aspect-square rounded-lg overflow-hidden bg-dark-card cursor-pointer hover:opacity-90 transition-opacity`}
              title={thumbSrc ? t('workDetail.expandImage') : t('workDetail.selectThumbnail')}
              onClick={async () => {
                if (thumbSrc && work.folder_path) {
                  const images = await api.getWorkImages(work.folder_path);
                  const thumbNorm = (work.thumbnail_path ?? '').replace(/\\/g, '/');
                  const idx = images.findIndex(
                    (p) => p.replace(/\\/g, '/') === thumbNorm
                  );
                  const initialIndex = idx >= 0 ? idx : 0;
                  setLightboxImages(images.length ? images : [work.thumbnail_path!]);
                  setLightboxInitialIndex(initialIndex);
                  setLightboxOpen(true);
                } else {
                  // サムネなし → ファイル選択ダイアログ
                  const selected = await openDialog({
                    title: t('workDetail.selectThumbnail'),
                    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }],
                    multiple: false,
                  });
                  if (selected) {
                    const path = typeof selected === 'string' ? selected : selected;
                    if (path) {
                      await api.setWorkThumbnail(work.id, path);
                      const d = await api.getWorkDetail(work.id);
                      if (d) setDetail(d);
                    }
                  }
                }
              }}
            >
              {thumbSrc ? (
                <img
                  src={thumbSrc}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 gap-2 hover:text-gray-400 transition-colors">
                  <ImagePlus size={40} />
                  <span className="text-xs">{t('workDetail.selectThumbnail')}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-semibold break-words">{work.title}</h1>
              <button
                onClick={async () => {
                  await api.toggleFavorite(work.id);
                  const d = await api.getWorkDetail(work.id);
                  if (d) setDetail(d);
                }}
                className={`p-2 rounded-full flex-shrink-0 ${
                  work.is_favorite ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                <Heart
                  size={24}
                  fill={work.is_favorite ? 'currentColor' : 'none'}
                />
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-2 truncate break-all">
              {work.folder_path}
            </p>

            <div className="mt-6">
              <VariantSelector
                variants={variants}
                selectedId={selectedVariant?.id ?? null}
                onSelect={setSelectedVariant}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-4">
              <WorkEntityEditor
                workId={work.id}
                title={t('voiceActors.title')}
                placeholder={t('workDetail.addVoiceActor')}
                removeTitle={t('workDetail.deleteVoiceActor')}
                getWorkItems={api.getWorkVoiceActors}
                getAllItems={api.getVoiceActors}
                addItem={api.addWorkVoiceActor}
                removeItem={api.removeWorkVoiceActor}
              />
              <WorkEntityEditor
                workId={work.id}
                title={t('circles.title')}
                placeholder={t('workDetail.addCircle')}
                removeTitle={t('workDetail.deleteCircle')}
                getWorkItems={api.getWorkCircles}
                getAllItems={api.getCircles}
                addItem={api.addWorkCircle}
                removeItem={api.removeWorkCircle}
              />
              <WorkEntityEditor
                workId={work.id}
                title={t('tags.title')}
                placeholder={t('workDetail.addTag')}
                removeTitle={t('workDetail.deleteTag')}
                getWorkItems={api.getWorkTags}
                getAllItems={api.getTags}
                addItem={api.addWorkTag}
                removeItem={api.removeWorkTag}
              />
            </div>
          </div>
        </div>

        {missingFiles.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg flex items-start gap-2">
            <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-300">
              <p className="font-medium">{t('workDetail.missingFiles', { count: missingFiles.length })}</p>
              <ul className="mt-1 text-yellow-400/70 text-xs space-y-0.5">
                {missingFiles.slice(0, 5).map((fp) => (
                  <li key={fp} className="truncate">{fp.split(/[/\\]/).pop()}</li>
                ))}
                {missingFiles.length > 5 && <li>...{t('workDetail.andMore', { count: missingFiles.length - 5 })}</li>}
              </ul>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <TrackList
            tracks={tracks}
            workId={work.id}
            variantId={selectedVariant?.id}
            onReorder={selectedVariant ? setTracks : undefined}
            onReset={selectedVariant ? setTracks : undefined}
          />
          <LoopSegmentList tracks={tracks} workId={work.id} />
        </div>
      </div>

      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxInitialIndex}
          title={work.title}
          onClose={() => setLightboxOpen(false)}
          onThumbnailSet={
            id
              ? async (imagePath) => {
                  await api.setWorkThumbnail(id, imagePath);
                  const d = await api.getWorkDetail(id);
                  if (d) setDetail(d);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
