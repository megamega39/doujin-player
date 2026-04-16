import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, SkipBack, SkipForward, Repeat, Film, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';
import { useMediaPlayer } from '../../hooks/useMediaPlayer';
import { useShortcutStore } from '../../stores/shortcutStore';
import { labelWithShortcut } from '../../utils/shortcutKey';
import { api, type PlayableItem } from '../../api';
import { ImageLightbox } from '../work-detail/ImageLightbox';
import {
  SeekBar,
  SpeedControl,
  SleepTimer,
  VolumeControl,
  LoopControls,
} from './mini-player';

export function MiniPlayer() {
  const {
    audioRef,
    videoRef,
    displayTime,
    displayDuration,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    loopSegment,
    loopEnabled,
    trackLoopEnabled,
    playlistLoopEnabled,
    trackList,
    currentSourcePlaylistId,
    effectiveIndex,
    isVideo,
    setPlaying,
    setPlayableItem,
    setTrackLoopEnabled,
    setPlaylistLoopEnabled,
    setCurrentTime,
    setVolume,
    setPlaybackRate,
    setLoopSegment,
    setLoopEnabled,
    seekToTime,
    seekBy,
    getMedia,
  } = useMediaPlayer();

  const { t } = useTranslation();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const tip = (label: string, id: string) => labelWithShortcut(label, shortcuts[id]);
  const [mutedVolume, setMutedVolume] = useState<number | null>(null);
  const [videoExpanded, setVideoExpanded] = useState(true);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [seekPreviewTime, setSeekPreviewTime] = useState<number | null>(null);
  const [saveSegmentDialog, setSaveSegmentDialog] = useState(false);
  const [saveSegmentName, setSaveSegmentName] = useState('');
  const [saveSegmentSnapshot, setSaveSegmentSnapshot] = useState<{ start: number; end: number } | null>(null);

  const isMuted = volume === 0;

  // 現在再生中の作品サムネイルを取得
  const [workThumbSrc, setWorkThumbSrc] = useState<string | null>(null);
  const [workFolderPath, setWorkFolderPath] = useState<string | null>(null);
  const [workTitle, setWorkTitle] = useState<string>('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const currentWorkId = trackList[effectiveIndex]?.workId ?? null;
  useEffect(() => {
    setWorkThumbSrc(null);
    setWorkFolderPath(null);
    setWorkTitle('');
    if (!currentWorkId) return;
    let cancelled = false;
    api.getWorkDetail(currentWorkId).then((d) => {
      if (cancelled || !d) return;
      setWorkFolderPath(d.work.folder_path);
      setWorkTitle(d.work.title);
      if (!d.work.thumbnail_path) {
        // サムネなし: タイトルだけでタスクバーサムネイル更新
        invoke('update_thumbbar_thumbnail', { thumbnailPath: null, title: currentTrack?.title ?? '' }).catch(() => {});
        return;
      }
      api.getThumbnailPath(d.work.thumbnail_path).then((filePath) => {
        if (!cancelled) {
          setWorkThumbSrc(convertFileSrc(filePath));
          // タスクバーサムネイル更新
          invoke('update_thumbbar_thumbnail', { thumbnailPath: filePath, title: currentTrack?.title ?? '' }).catch(() => {});
        }
      }).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [currentWorkId, currentTrack?.title]);

  // 動画トラックに切り替えた時に動画ビューを展開
  useEffect(() => {
    if (isVideo) setVideoExpanded(true);
  }, [currentTrack?.id, isVideo]);

  // スリープタイマー
  useEffect(() => {
    if (sleepTimerRemaining == null || sleepTimerRemaining <= 0) return;
    const id = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev == null || prev <= 1) {
          setPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [sleepTimerRemaining, setPlaying]);

  if (!currentTrack) {
    return (
      <div className="h-20 bg-dark-card border-t border-dark-border flex items-center justify-center text-gray-400">
        {t('player.selectTrack')}
      </div>
    );
  }

  const rawDur = displayDuration || (isFinite(duration) && duration > 0 ? duration : 0) || getMedia()?.duration || 0;
  const dur = isFinite(rawDur) && rawDur > 0 ? rawDur : 0;
  const time = seekPreviewTime ?? displayTime ?? currentTime;

  return (
    <div className="bg-dark-card border-t border-dark-border flex flex-col flex-shrink-0 relative z-[60]">
      <audio
        ref={audioRef}
        preload="auto"
        style={{ display: isVideo ? 'none' : undefined }}
        onError={(e) => console.error('[Audio] load error:', (e.target as HTMLAudioElement)?.error)}
      />
      {!isVideo && <video ref={videoRef} style={{ display: 'none' }} playsInline />}

      {/* 動画トラック選択時のみ: 操作パネル上部に表示 */}
      {isVideo && (
        <div className="border-b border-dark-border">
          <div
            className={`grid transition-[grid-template-rows] duration-200 ease-out ${
              videoExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className="relative flex pl-sidebar pr-4 py-2 h-[calc(100vh-8rem)] min-h-[200px] bg-dark-bg cursor-pointer"
                onDoubleClick={() => setVideoExpanded(false)}
                title={t('player.doubleClickToCloseVideo')}
              >
                <div className="flex-1 min-w-0 flex items-center justify-center overflow-hidden rounded-lg bg-black">
                  <video
                    ref={videoRef}
                    className="max-w-full max-h-full w-auto h-auto object-contain"
                    playsInline
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setVideoExpanded(false);
                    }}
                  />
                </div>
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      videoRef.current?.requestFullscreen?.().catch(() => {});
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-card/90 hover:bg-dark-hover text-gray-200 text-sm border border-dark-border shadow-lg transition-colors"
                    title={t('player.fullscreen')}
                  >
                    <Maximize2 size={18} />
                    {t('player.fullscreen')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoExpanded(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-card/90 hover:bg-dark-hover text-gray-200 text-sm border border-dark-border shadow-lg transition-colors"
                    title={t('player.closeVideo')}
                  >
                    <ChevronDown size={18} />
                    {t('player.closeVideo')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          {!videoExpanded && (
            <button
              onClick={() => setVideoExpanded(true)}
              className="w-full pl-sidebar pr-4 py-2 flex items-center gap-2 text-gray-400 hover:text-gray-200 hover:bg-dark-hover/50 transition-colors text-sm"
              title={t('player.showVideo')}
            >
              <Film size={16} />
              <span>{t('player.showVideo')}</span>
              <ChevronUp size={16} className="ml-auto" />
            </button>
          )}
        </div>
      )}

      {/* 操作パネル */}
      <div className="py-2 relative">
      {/* サムネイル（サイドバー幅領域） */}
      {workThumbSrc && (
        <div className="hidden md:flex absolute left-0 top-0 bottom-0 w-[12rem] items-center justify-center p-1 z-10">
          <button
            className="h-full aspect-square hover:opacity-80 transition-opacity mx-auto cursor-pointer"
            title={t('player.fullscreen')}
            onClick={async () => {
              if (!workFolderPath) return;
              const images = await api.getWorkImages(workFolderPath);
              setLightboxImages(images.length > 0 ? images : []);
              setLightboxOpen(true);
            }}
          >
            <img
              src={workThumbSrc}
              alt=""
              className="h-full w-full rounded object-cover"
            />
          </button>
        </div>
      )}
      {/* 上段: トラック名 | 中央:操作ボタン+音量 */}
      <div className="flex items-center gap-1 sm:gap-4 pl-2 sm:pl-sidebar pr-2 sm:pr-4 min-h-[2.5rem]">
        <div className="hidden sm:flex flex-col flex-1 min-w-0 justify-center gap-0">
          <div className="flex items-center gap-2 truncate text-sm font-medium">
            {isVideo && <Film size={14} className="text-gray-400 flex-shrink-0" />}
            {currentSourcePlaylistId ? (
              <Link
                to={`/playlists/${currentSourcePlaylistId}`}
                className="truncate hover:text-accent hover:underline"
                title={t('player.toPlaylist')}
              >
                {currentTrack.title}
              </Link>
            ) : (() => {
              const item = trackList[effectiveIndex];
              const workId = item?.workId;
              return workId ? (
                <Link
                  to={`/work/${workId}`}
                  className="truncate hover:text-accent hover:underline"
                  title={t('player.toWorkDetail')}
                >
                  {currentTrack.title}
                </Link>
              ) : (
                <span className="truncate">{currentTrack.title}</span>
              );
            })()}
          </div>
          {workTitle && (
            <div className="truncate text-xs text-gray-400">
              {currentWorkId ? (
                <Link to={`/work/${currentWorkId}`} className="hover:text-accent truncate">
                  {workTitle}
                </Link>
              ) : (
                workTitle
              )}
            </div>
          )}
        </div>
        <div className="flex flex-1 justify-center min-w-0 overflow-hidden sm:flex-initial">
          <div className="flex flex-nowrap items-center justify-center gap-0.5 sm:gap-1 shrink-0">
            <button
              onClick={() => seekBy(-30)}
              className="hidden lg:inline-flex px-2 py-1.5 rounded-md hover:bg-dark-hover text-xs font-medium text-gray-400 tabular-nums"
              title={tip(t('player.seekBack30'), 'seek_backward_more')}
            >
              −30
            </button>
            <button
              onClick={() => seekBy(-10)}
              className="hidden md:inline-flex px-2 py-1.5 rounded-md hover:bg-dark-hover text-xs font-medium text-gray-400 tabular-nums"
              title={tip(t('player.seekBack10'), 'seek_backward')}
            >
              −10
            </button>
            <button
              onClick={() => {
                if (trackList.length === 0) return;
                const idx = effectiveIndex;
                let prevItem: PlayableItem | null = null;
                let prevIdx = -1;
                if (idx > 0) {
                  prevIdx = idx - 1;
                  prevItem = trackList[prevIdx] ?? null;
                } else if (playlistLoopEnabled && trackList.length > 1) {
                  prevIdx = trackList.length - 1;
                  prevItem = trackList[prevIdx] ?? null;
                } else if (idx === 0) {
                  const media = getMedia();
                  if (media && media.currentTime > 3) {
                    media.currentTime = 0;
                    setCurrentTime(0);
                    return;
                  }
                }
                if (prevItem != null && prevIdx >= 0) {
                  setPlayableItem(prevItem, prevIdx);
                  setPlaying(true);
                }
              }}
              disabled={trackList.length === 0}
              className="p-1.5 sm:p-2 rounded-full hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed opacity-70"
              title={tip(t('player.prevTrack'), 'prev_track')}
            >
              <SkipBack size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>
            <button
              onClick={() => setPlaying(!isPlaying)}
              className="p-2 sm:p-3 rounded-full hover:bg-dark-hover bg-dark-hover/50"
              title={tip(t('shortcuts.playPause'), 'play_pause')}
            >
              {isPlaying ? <Pause size={22} className="sm:w-[26px] sm:h-[26px]" /> : <Play size={22} className="sm:w-[26px] sm:h-[26px]" />}
            </button>
            <button
              onClick={() => {
                if (trackList.length === 0) return;
                const idx = effectiveIndex;
                const nextIdx =
                  idx >= 0 && idx < trackList.length - 1
                    ? idx + 1
                    : playlistLoopEnabled && trackList.length > 0
                      ? 0
                      : -1;
                const nextItem = nextIdx >= 0 ? trackList[nextIdx] ?? null : null;
                if (nextItem != null && nextIdx >= 0) {
                  setPlayableItem(nextItem, nextIdx);
                  setPlaying(true);
                } else {
                  setPlaying(false);
                }
              }}
              disabled={trackList.length === 0}
              className="p-1.5 sm:p-2 rounded-full hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed opacity-70"
              title={tip(t('player.nextTrack'), 'next_track')}
            >
              <SkipForward size={18} className="sm:w-[22px] sm:h-[22px]" />
            </button>
            <button
              onClick={() => seekBy(10)}
              className="hidden md:inline-flex px-2 py-1.5 rounded-md hover:bg-dark-hover text-xs font-medium text-gray-400 tabular-nums"
              title={tip(t('player.seekForward10'), 'seek_forward')}
            >
              +10
            </button>
            <button
              onClick={() => seekBy(30)}
              className="hidden lg:inline-flex px-2 py-1.5 rounded-md hover:bg-dark-hover text-xs font-medium text-gray-400 tabular-nums"
              title={tip(t('player.seekForward30'), 'seek_forward_more')}
            >
              +30
            </button>
            <button
              onClick={() => {
                if (trackLoopEnabled) {
                  setTrackLoopEnabled(false);
                } else if (playlistLoopEnabled) {
                  setPlaylistLoopEnabled(false);
                  setTrackLoopEnabled(true);
                } else {
                  setPlaylistLoopEnabled(true);
                }
              }}
              className={`hidden md:inline-flex p-2 rounded-full transition-colors relative ${playlistLoopEnabled || trackLoopEnabled ? 'text-accent bg-accent/20' : 'hover:bg-dark-hover opacity-70'}`}
              title={
                trackLoopEnabled ? tip(t('player.loopTrack'), 'toggle_loop') :
                playlistLoopEnabled ? tip(t('player.loopPlaylist'), 'toggle_loop') :
                tip(t('player.loopOff'), 'toggle_loop')
              }
            >
              <span className="relative inline-flex items-center justify-center w-5 h-5">
                <Repeat size={20} className={trackLoopEnabled ? 'opacity-50' : ''} />
                {trackLoopEnabled && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold leading-none">
                    1
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
        <div className="hidden sm:flex flex-1 items-center justify-end gap-2 sm:gap-3 min-w-0 flex-shrink-0">
          <span className="hidden xl:inline">
            <SpeedControl playbackRate={playbackRate} onRateChange={setPlaybackRate} />
          </span>
          <span className="hidden xl:inline">
            <SleepTimer
              remaining={sleepTimerRemaining}
              onSet={setSleepTimerRemaining}
            />
          </span>
          <span className="hidden lg:inline">
            <VolumeControl
            volume={volume}
            muted={isMuted}
            onVolumeChange={(v) => {
              setVolume(v);
              if (v > 0) setMutedVolume(null);
            }}
            onMuteToggle={() => {
              if (isMuted) {
                setVolume(mutedVolume ?? 1);
                setMutedVolume(null);
              } else {
                setMutedVolume(volume);
                setVolume(0);
              }
            }}
          />
          </span>
        </div>
      </div>

      {/* 区間ループ: A点・B点 */}
      <div className="hidden sm:flex flex-wrap items-center gap-1.5 pl-sidebar pr-4 py-1">
        <LoopControls
          loopSegment={loopSegment}
          loopEnabled={loopEnabled}
          onLoopToggle={() => loopSegment && loopSegment.start < loopSegment.end && setLoopEnabled(!loopEnabled)}
          onSetA={() => {
            const t = time;
            setLoopSegment({
              start: t,
              end: loopSegment ? loopSegment.end : Math.min(t + 1, (dur && dur > 0 ? dur : t + 1)),
            });
          }}
          onSetB={() => {
            const t = time;
            setLoopSegment({
              start: loopSegment ? loopSegment.start : Math.max(0, t - 1),
              end: t,
            });
          }}
          onAdjustA={(delta) => {
            if (!loopSegment) return;
            const newStart = Math.max(0, loopSegment.start + delta);
            if (newStart < loopSegment.end) {
              setLoopSegment({ ...loopSegment, start: newStart });
            }
          }}
          onAdjustB={(delta) => {
            if (!loopSegment) return;
            const maxDur = dur && dur > 0 ? dur : Infinity;
            const newEnd = Math.min(maxDur, Math.max(0, loopSegment.end + delta));
            if (newEnd > loopSegment.start) {
              setLoopSegment({ ...loopSegment, end: newEnd });
            }
          }}
          onClearSegment={() => {
            setLoopSegment(null);
            setLoopEnabled(false);
          }}
          onSaveSegment={
            currentTrack && loopSegment
              ? () => {
                  setSaveSegmentName(t('player.segmentNameDefault'));
                  setSaveSegmentSnapshot({ start: loopSegment.start, end: loopSegment.end });
                  setSaveSegmentDialog(true);
                }
              : undefined
          }
        />
      </div>

      {/* 下段: シークバー */}
      <div className="flex items-center justify-center pl-2 sm:pl-sidebar pr-2 sm:pr-4 pb-1 min-w-0">
        <SeekBar
          currentTime={displayTime}
          duration={dur ?? 0}
          seekPreviewTime={seekPreviewTime}
          loopSegment={loopSegment}
          loopEnabled={loopEnabled}
          onSeek={seekToTime}
          onSeekPreview={setSeekPreviewTime}
        />
      </div>
      </div>

      {/* 区間保存ダイアログ */}
      {saveSegmentDialog && currentTrack && saveSegmentSnapshot && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60" onClick={() => setSaveSegmentDialog(false)}>
          <div className="bg-dark-card border border-dark-border rounded-xl p-5 w-80 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-medium mb-3">{t('player.segmentName')}</h3>
            <input
              type="text"
              value={saveSegmentName}
              onChange={(e) => setSaveSegmentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = saveSegmentName.trim() || t('player.segmentNameDefault');
                  api.saveLoopSegment(currentTrack.id, name, saveSegmentSnapshot.start, saveSegmentSnapshot.end)
                    .then(() => window.dispatchEvent(new CustomEvent('loop-segment-saved')))
                    .catch(console.error);
                  setSaveSegmentDialog(false);
                }
                if (e.key === 'Escape') setSaveSegmentDialog(false);
              }}
              autoFocus
              className="w-full px-3 py-2 bg-dark-hover border border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSaveSegmentDialog(false)}
                className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:bg-dark-hover"
              >
                {t('shortcutModal.close')}
              </button>
              <button
                onClick={() => {
                  const name = saveSegmentName.trim() || t('player.segmentNameDefault');
                  api.saveLoopSegment(currentTrack.id, name, saveSegmentSnapshot.start, saveSegmentSnapshot.end)
                    .then(() => window.dispatchEvent(new CustomEvent('loop-segment-saved')))
                    .catch(console.error);
                  setSaveSegmentDialog(false);
                }}
                className="px-4 py-1.5 rounded-lg text-sm bg-accent hover:bg-accent/80 text-white font-medium"
              >
                {t('player.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxOpen && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={0}
          title={workTitle}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
