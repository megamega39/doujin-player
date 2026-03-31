import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Trash2, Music, Film, ExternalLink } from 'lucide-react';
import { SortableControls } from '../components/common/SortableControls';
import {
  DndContext,
  closestCenter,
  PointerSensor,
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
import { api, type Playlist, type PlaylistTrackItem, type PlayableItem } from '../api';
import { usePlayerStore } from '../stores/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '../i18n';
import { isVideoTrack } from '../utils/media';
import { formatDuration } from '../utils/format';

interface SortablePlaylistTrackRowProps {
  item: PlaylistTrackItem;
  idx: number;
  itemsCount: number;
  isCurrentPlaying: boolean;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlayOrPause: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

function SortablePlaylistTrackRow({
  item,
  idx,
  itemsCount,
  isCurrentPlaying,
  isCurrentTrack,
  isPlaying,
  onPlayOrPause,
  onMoveUp,
  onMoveDown,
  onRemove,
}: SortablePlaylistTrackRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.item_id });

  const { track, work_id, segment_start_sec, segment_end_sec } = item;
  const isVideo = isVideoTrack(track.file_path);
  const isSegmentItem =
    segment_start_sec != null &&
    segment_end_sec != null &&
    segment_start_sec < segment_end_sec;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onPlayOrPause}
      className={`flex items-center gap-1.5 p-3 rounded-lg cursor-pointer transition-colors group ${
        isDragging ? 'opacity-50 shadow-lg' : isCurrentPlaying
          ? 'bg-accent/20 border border-accent/50'
          : isCurrentTrack
            ? 'bg-accent/10 border border-accent/30'
            : 'bg-dark-card hover:bg-dark-hover border border-dark-border'
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        onClick={(e) => e.stopPropagation()}
        title={t('playlists.dragToReorder')}
      >
        <SortableControls idx={idx} total={itemsCount} onMoveUp={onMoveUp} onMoveDown={onMoveDown} />
      </span>
      <span className="flex items-center gap-0.5 flex-shrink-0">
        <span className="w-6 flex items-center justify-center text-accent">
          {isCurrentTrack ? (
            isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )
          ) : null}
        </span>
        <span className="w-6 text-right text-gray-400 font-mono text-sm">
          {idx + 1}
        </span>
      </span>
      <span
        className="flex-shrink-0 text-gray-400"
        title={isVideo ? t('playlists.video') : t('playlists.audio')}
      >
        {isVideo ? <Film size={14} /> : <Music size={14} />}
      </span>
      <span className="flex-1 min-w-0 truncate">
        {track.title}
        {isSegmentItem && (
          <span className="text-gray-400 text-sm ml-1">
            ({formatDuration(segment_start_sec!)}→{formatDuration(segment_end_sec!)})
          </span>
        )}
      </span>
      <span className="flex-shrink-0 text-gray-400 text-sm font-mono tabular-nums min-w-[3.5rem] text-right">
        {isSegmentItem
          ? `${formatDuration(segment_start_sec!)}→${formatDuration(segment_end_sec!)}`
          : formatDuration(track.duration_sec)}
      </span>
      <Link
        to={`/work/${work_id}`}
        onClick={(e) => e.stopPropagation()}
        className="p-2 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/20 transition-colors flex-shrink-0"
        title={t('playlists.toWorkDetail')}
      >
        <ExternalLink size={16} />
      </Link>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title={t('playlists.removeFromPlaylist')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export function PlaylistDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [items, setItems] = useState<PlaylistTrackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    currentTrack,
    currentTrackIndex,
    isPlaying,
    loopSegment,
    setCurrentTrack,
    setPlayableItem,
    setPlaying,
    setTrackList,
    trackList: playerTrackList,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      currentTrackIndex: s.currentTrackIndex,
      isPlaying: s.isPlaying,
      loopSegment: s.loopSegment,
      setCurrentTrack: s.setCurrentTrack,
      setPlayableItem: s.setPlayableItem,
      setPlaying: s.setPlaying,
      setTrackList: s.setTrackList,
      trackList: s.trackList,
    }))
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [list, tracks] = await Promise.all([
        api.getPlaylists(),
        api.getPlaylistTracks(id),
      ]);
      const pl = list.find((p) => p.id === id) ?? null;
      setPlaylist(pl);
      setItems(tracks);
    } catch (e) {
      console.error('Failed to load playlist:', e);
      setError(e instanceof Error ? e.message : t('playlists.loadError'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  function itemsToPlayableItems(plItems: PlaylistTrackItem[]): PlayableItem[] {
    return plItems.map((i) => {
      const isSeg =
        i.segment_start_sec != null &&
        i.segment_end_sec != null &&
        i.segment_start_sec < i.segment_end_sec;
      return {
        track: i.track,
        workId: i.work_id,
        segment: isSeg
          ? {
              id: '',
              name: '',
              start: i.segment_start_sec!,
              end: i.segment_end_sec!,
            }
          : undefined,
      };
    });
  }

  function handlePlayOrPause(item: PlaylistTrackItem, idx: number) {
    const { track, segment_start_sec, segment_end_sec } = item;
    const isSegmentItem =
      segment_start_sec != null &&
      segment_end_sec != null &&
      segment_start_sec < segment_end_sec;
    const isCurrent =
      currentTrackIndex === idx &&
      currentTrack?.id === track.id &&
      (!isSegmentItem ||
        (loopSegment?.start === segment_start_sec &&
          loopSegment?.end === segment_end_sec));
    if (isCurrent && isPlaying) {
      setPlaying(false);
      return;
    }
    const playableItems = itemsToPlayableItems(items);
    setTrackList(playableItems, id ?? null);
    const playItem = playableItems[idx];
    if (!playItem) return;
    if (isSegmentItem) {
      setPlayableItem(playItem, idx);
    } else {
      setCurrentTrack(track, idx);
    }
    setPlaying(true);
  }

  async function handleRemoveItem(itemId: string) {
    if (!id) return;
    try {
      await api.removePlaylistItem(id, itemId);
      load();
    } catch (e) {
      console.error('Failed to remove track:', e);
    }
  }

  async function handleReorder(newItems: PlaylistTrackItem[]) {
    if (!id) return;
    const itemIds = newItems.map((i) => i.item_id);
    try {
      await api.reorderPlaylistItems(id, itemIds);
      setItems(newItems);
      // このプレイリストを再生中なら trackList と currentTrackIndex を更新
      const oldItems = itemsToPlayableItems(items);
      const samePlaylist =
        oldItems.length === playerTrackList.length &&
        oldItems.every((o, i) => {
          const p = playerTrackList[i];
          if (!p) return false;
          if (o.track.id !== p.track.id) return false;
          if (o.segment && p.segment)
            return o.segment.start === p.segment!.start && o.segment.end === p.segment!.end;
          return !o.segment && !p.segment;
        });
      if (samePlaylist && currentTrack) {
        const newPlayable = itemsToPlayableItems(newItems);
        setTrackList(newPlayable, id ?? null);
        const sameIdx = newItems.findIndex(
          (i) =>
            i.track.id === currentTrack.id &&
            (loopSegment == null
              ? i.segment_start_sec == null || i.segment_end_sec == null
              : i.segment_start_sec === loopSegment.start &&
                i.segment_end_sec === loopSegment.end)
        );
        if (sameIdx >= 0) {
          const playItem = newPlayable[sameIdx];
          if (playItem) {
            if (playItem.segment) setPlayableItem(playItem, sameIdx);
            else setCurrentTrack(playItem.track, sameIdx);
          }
        }
      }
    } catch (e) {
      console.error('Failed to reorder:', e);
    }
  }

  function handleMoveUp(idx: number) {
    if (idx <= 0) return;
    const newItems = [...items];
    [newItems[idx - 1], newItems[idx]] = [newItems[idx]!, newItems[idx - 1]!];
    handleReorder(newItems);
  }

  function handleMoveDown(idx: number) {
    if (idx >= items.length - 1) return;
    const newItems = [...items];
    [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1]!, newItems[idx]!];
    handleReorder(newItems);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.item_id === active.id);
    const newIndex = items.findIndex((i) => i.item_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newItems = arrayMove(items, oldIndex, newIndex);
    handleReorder(newItems);
  }

  if (!id) {
    return (
      <div className="px-6 py-6">
        <Link to="/playlists" className="text-accent hover:underline">
          {t('playlists.backToPlaylists')}
        </Link>
        <p className="mt-4 text-gray-300">{t('playlists.notFound')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-6">
        <Link
          to="/playlists"
          className="inline-flex items-center gap-2 text-accent hover:underline mb-4"
        >
          {t('playlists.backToPlaylists')}
        </Link>
        <p className="text-red-400">{t('error.title')}: {error}</p>
        <p className="mt-2 text-gray-400 text-sm">
          {t('playlists.retryHint')}
        </p>
      </div>
    );
  }

  if (loading || !playlist) {
    return (
      <div className="px-6 py-6">
        <Link
          to="/playlists"
          className="inline-flex items-center gap-2 text-accent hover:underline mb-4"
        >
          {t('playlists.backToPlaylists')}
        </Link>
        <p className="text-gray-300">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <Link
        to="/playlists"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-inherit mb-6"
      >
        <ArrowLeft size={20} />
        {t('playlists.backToList')}
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-semibold">{playlist.name}</h1>
        <span className="text-gray-400">
          {t('playlists.tracks', { count: items.length })}
        </span>
        {items.length > 0 && (
          <button
            onClick={async () => {
              try {
                await api.clearPlaylist(playlist.id);
                setItems([]);
              } catch (e) {
                console.error('Failed to clear playlist:', e);
              }
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            title={t('playlists.clearAll')}
          >
            <Trash2 size={14} />
            {t('playlists.clearAll')}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-gray-400 py-8">
          {t('playlists.noTracks')}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.item_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {items.map((item, idx) => {
                const { track } = item;
                const isCurrentPlaying =
                  currentTrackIndex === idx &&
                  currentTrack?.id === track.id &&
                  isPlaying;
                const isCurrentTrack =
                  currentTrackIndex === idx && currentTrack?.id === track.id;
                return (
                  <SortablePlaylistTrackRow
                    key={item.item_id}
                    item={item}
                    idx={idx}
                    itemsCount={items.length}
                    isCurrentPlaying={isCurrentPlaying}
                    isCurrentTrack={isCurrentTrack}
                    isPlaying={isPlaying}
                    onPlayOrPause={() => handlePlayOrPause(item, idx)}
                    onMoveUp={() => handleMoveUp(idx)}
                    onMoveDown={() => handleMoveDown(idx)}
                    onRemove={() => handleRemoveItem(item.item_id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
