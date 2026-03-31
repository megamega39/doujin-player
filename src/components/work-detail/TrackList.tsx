import { useState, useCallback } from 'react';
import type { Track, PlayableItem } from '../../api';
import { Film, Music, RotateCcw, Heart } from 'lucide-react';
import { SortableControls } from '../common/SortableControls';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../../stores/playerStore';
import { useTranslation } from '../../i18n';
import { isVideoTrack } from '../../utils/media';
import { formatDuration } from '../../utils/format';
import { api } from '../../api';
import { PlayableItemRow } from './PlayableItemRow';
import { AddToPlaylistButton } from './AddToPlaylistButton';

interface TrackListProps {
  tracks: Track[];
  workId?: string;
  /** 指定時は DnD で並び替え可能。reorderTracks API を呼び DB を更新する */
  variantId?: string;
  onReorder?: (newTracks: Track[]) => void;
  /** リセット後のトラック受け取り（resetTrackOrder から返る） */
  onReset?: (newTracks: Track[]) => void;
}

interface SortableTrackRowProps {
  track: Track;
  idx: number;
  tracksCount: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onPlayOrPause: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleFavorite: () => void;
}

function SortableTrackRow({
  track,
  idx,
  tracksCount,
  isCurrent,
  isPlaying,
  onPlayOrPause,
  onMoveUp,
  onMoveDown,
  onToggleFavorite,
}: SortableTrackRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const isVideo = isVideoTrack(track.file_path);
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isDragging ? 'opacity-50 z-10 relative' : ''} cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      <PlayableItemRow
        isCurrent={isCurrent}
        isPlaying={isPlaying}
        onClick={onPlayOrPause}
        leadingSlot={
          <>
            <SortableControls idx={idx} total={tracksCount} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
            <span className="w-8 text-right text-gray-400 font-mono text-sm">
              {idx + 1}
            </span>
          </>
        }
        mediaIconSlot={
          <span title={isVideo ? t('playlists.video') : t('playlists.audio')}>
            {isVideo ? <Film size={14} /> : <Music size={14} />}
          </span>
        }
        middleContent={track.title}
        trailingSlot={formatDuration(track.duration_sec)}
        actionsSlot={
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              className={`p-1.5 rounded-full transition-colors ${
                track.is_favorite ? 'text-red-500' : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <Heart size={14} fill={track.is_favorite ? 'currentColor' : 'none'} />
            </button>
            <AddToPlaylistButton trackId={track.id} />
          </div>
        }
      />
    </div>
  );
}

export function TrackList({ tracks: initialTracks, workId = '', variantId, onReorder, onReset }: TrackListProps) {
  // ローカルでお気に入り状態を即座に反映するための state
  const [favOverrides, setFavOverrides] = useState<Record<string, boolean>>({});
  const tracks = initialTracks.map((t) => ({
    ...t,
    is_favorite: favOverrides[t.id] ?? t.is_favorite,
  }));

  const handleToggleTrackFavorite = useCallback(async (trackId: string) => {
    try {
      const newFav = await api.toggleTrackFavorite(trackId);
      setFavOverrides((prev) => ({ ...prev, [trackId]: newFav }));
    } catch (e) {
      console.error('Failed to toggle track favorite:', e);
    }
  }, []);
  const { t } = useTranslation();
  const {
    currentTrack,
    isPlaying,
    trackList: playerTrackList,
    currentSourcePlaylistId,
    setCurrentTrack,
    setPlaying,
      setTrackList,
    setLoopSegment,
    setLoopEnabled,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      trackList: s.trackList,
      currentSourcePlaylistId: s.currentSourcePlaylistId,
      setCurrentTrack: s.setCurrentTrack,
      setPlaying: s.setPlaying,
      setTrackList: s.setTrackList,
      setLoopSegment: s.setLoopSegment,
      setLoopEnabled: s.setLoopEnabled,
    }))
  );

  function playTrack(track: Track) {
    const idx = tracks.findIndex((tr) => tr.id === track.id);
    if (idx >= 0 && currentTrack?.id === track.id && isPlaying) {
      setPlaying(false);
      return;
    }
    setLoopSegment(null);
    setLoopEnabled(false);
    const items: PlayableItem[] = tracks.map((tr) => ({ track: tr, workId }));
    setTrackList(items);
    setCurrentTrack(track, idx >= 0 ? idx : undefined);
    setPlaying(true);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  async function handleReorder(newTracks: Track[]) {
    if (!variantId || !onReorder) return;
    try {
      await api.reorderTracks(variantId, newTracks.map((tr) => tr.id));
      onReorder(newTracks);
      // この作品を再生中なら trackList と currentTrackIndex を新しい順序で更新
      if (currentSourcePlaylistId == null && currentTrack && playerTrackList.length === newTracks.length) {
        const playerIds = new Set(playerTrackList.map((p) => p.track.id));
        const newIds = new Set(newTracks.map((tr) => tr.id));
        const sameWork =
          playerIds.size === newIds.size &&
          [...playerIds].every((id) => newIds.has(id)) &&
          playerTrackList.every((p) => p.workId === workId);
        if (sameWork) {
          const newPlayable: PlayableItem[] = newTracks.map((tr) => ({ track: tr, workId }));
          setTrackList(newPlayable);
          const idx = newTracks.findIndex((tr) => tr.id === currentTrack.id);
          if (idx >= 0) {
            const item = newPlayable[idx];
            if (item) setCurrentTrack(item.track, idx);
          }
        }
      }
    } catch (e) {
      console.error('Failed to reorder tracks:', e);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const oldIndex = tracks.findIndex((tr) => tr.id === activeId);
    const newIndex = tracks.findIndex((tr) => tr.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const newTracks = arrayMove(tracks, oldIndex, newIndex);
    handleReorder(newTracks);
  }

  function handleMoveUp(idx: number) {
    if (idx <= 0) return;
    const newTracks = [...tracks];
    [newTracks[idx - 1], newTracks[idx]] = [newTracks[idx]!, newTracks[idx - 1]!];
    handleReorder(newTracks);
  }

  function handleMoveDown(idx: number) {
    if (idx >= tracks.length - 1) return;
    const newTracks = [...tracks];
    [newTracks[idx], newTracks[idx + 1]] = [newTracks[idx + 1]!, newTracks[idx]!];
    handleReorder(newTracks);
  }

  async function handleResetOrder() {
    if (!variantId || !onReset) return;
    try {
      const newTracks = await api.resetTrackOrder(variantId);
      onReset(newTracks);
      if (currentSourcePlaylistId == null && currentTrack && playerTrackList.length === newTracks.length) {
        const playerIds = new Set(playerTrackList.map((p) => p.track.id));
        const newIds = new Set(newTracks.map((tr) => tr.id));
        const sameWork =
          playerIds.size === newIds.size &&
          [...playerIds].every((id) => newIds.has(id)) &&
          playerTrackList.every((p) => p.workId === workId);
        if (sameWork) {
          const newPlayable: PlayableItem[] = newTracks.map((tr) => ({ track: tr, workId }));
          setTrackList(newPlayable);
          const idx = newTracks.findIndex((tr) => tr.id === currentTrack.id);
          if (idx >= 0) {
            const item = newPlayable[idx];
            if (item) setCurrentTrack(item.track, idx);
          }
        }
      }
    } catch (e) {
      console.error('Failed to reset track order:', e);
    }
  }

  const content = (
    <div className="space-y-1">
      {variantId && onReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tracks.map((tr) => tr.id)}
            strategy={verticalListSortingStrategy}
          >
            {tracks.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <SortableTrackRow
                  key={track.id}
                  track={track}
                  idx={idx}
                  tracksCount={tracks.length}
                  isCurrent={isCurrent}
                  isPlaying={isPlaying}
                  onPlayOrPause={() => playTrack(track)}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)}
                  onToggleFavorite={() => handleToggleTrackFavorite(track.id)}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      ) : (
        tracks.map((track) => {
          const isVideo = isVideoTrack(track.file_path);
          const isCurrent = currentTrack?.id === track.id;
          return (
            <PlayableItemRow
              key={track.id}
              isCurrent={isCurrent}
              isPlaying={isPlaying}
              onClick={() => playTrack(track)}
              leadingSlot={
                <span className="w-8 text-right text-gray-400 font-mono text-sm">
                  {track.track_no}
                </span>
              }
              mediaIconSlot={
                <span title={isVideo ? t('playlists.video') : t('playlists.audio')}>
                  {isVideo ? <Film size={14} /> : <Music size={14} />}
                </span>
              }
              middleContent={track.title}
              trailingSlot={formatDuration(track.duration_sec)}
              actionsSlot={
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleTrackFavorite(track.id); }}
                    className={`p-1.5 rounded-full transition-colors ${
                      track.is_favorite ? 'text-red-500' : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <Heart size={14} fill={track.is_favorite ? 'currentColor' : 'none'} />
                  </button>
                  <AddToPlaylistButton trackId={track.id} />
                </div>
              }
            />
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h4 className="text-sm font-medium text-gray-400">{t('workDetail.trackList')}</h4>
        <div className="flex items-center gap-2">
          {variantId && onReset && tracks.length > 0 && (
            <button
              type="button"
              onClick={handleResetOrder}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-dark-hover text-xs transition-colors"
              title={t('workDetail.resetTrackOrder')}
            >
              <RotateCcw size={14} />
              {t('workDetail.resetTrackOrder')}
            </button>
          )}
          {tracks.length > 0 && (
            <AddToPlaylistButton
              trackIds={tracks.map((tr) => tr.id)}
              multiple
              label={t('workDetail.addAllToPlaylist')}
            />
          )}
        </div>
      </div>
      {content}
    </div>
  );
}
