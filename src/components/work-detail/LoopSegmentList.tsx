import { useState, useEffect, useMemo, useRef } from 'react';
import { Repeat, Trash2, Pencil, Check } from 'lucide-react';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { PlayableItemRow } from './PlayableItemRow';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '../../i18n';
import { api, type Track, type LoopSegment, type PlayableItem } from '../../api';
import { usePlayerStore } from '../../stores/playerStore';
import { formatDuration } from '../../utils/format';

interface LoopSegmentListProps {
  tracks: Track[];
  workId?: string;
}

export function LoopSegmentList({ tracks, workId = '' }: LoopSegmentListProps) {
  const { t } = useTranslation();
  const [segmentsByTrack, setSegmentsByTrack] = useState<
    Record<string, LoopSegment[]>
  >({});
  const {
    currentTrack,
    loopSegment,
    loopEnabled,
    isPlaying,
    setTrackList,
    setPlayableItem,
    setPlaying,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      loopSegment: s.loopSegment,
      loopEnabled: s.loopEnabled,
      isPlaying: s.isPlaying,
      setTrackList: s.setTrackList,
      setPlayableItem: s.setPlayableItem,
      setPlaying: s.setPlaying,
    }))
  );

  const trackIds = useMemo(() => tracks.map((t) => t.id).join(','), [tracks]);

  const loadSegments = useMemo(
    () => async () => {
      if (tracks.length === 0) return;
      const results = await Promise.all(
        tracks.map((t) => api.getLoopSegments(t.id))
      );
      const map: Record<string, LoopSegment[]> = {};
      tracks.forEach((t, i) => {
        if (results[i]?.length) map[t.id] = results[i];
      });
      setSegmentsByTrack(map);
    },
    [trackIds, tracks]
  );

  useEffect(() => {
    loadSegments();
  }, [loadSegments]);

  useEffect(() => {
    const handler = () => loadSegments();
    window.addEventListener('loop-segment-saved', handler);
    return () => window.removeEventListener('loop-segment-saved', handler);
  }, [loadSegments]);

  const allSegments: { track: Track; segment: LoopSegment }[] = [];
  tracks.forEach((track) => {
    const segs = segmentsByTrack[track.id] ?? [];
    segs.forEach((seg) => allSegments.push({ track, segment: seg }));
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const startEditing = (segment: LoopSegment) => {
    setEditingId(segment.id);
    setEditName(segment.name || t('player.segmentNameDefault'));
    setTimeout(() => editInputRef.current?.focus(), 0);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const trimmed = editName.trim();
    if (trimmed) {
      await api.updateLoopSegmentName(editingId, trimmed).catch(console.error);
      loadSegments();
    }
    setEditingId(null);
  };

  if (allSegments.length === 0) return null;

  function isSegmentCurrent(track: Track, segment: LoopSegment): boolean {
    if (!currentTrack || !loopSegment || !loopEnabled) return false;
    if (currentTrack.id !== track.id) return false;
    return (
      loopSegment.start === segment.start_sec &&
      loopSegment.end === segment.end_sec
    );
  }

  function handleSegmentClick(track: Track, segment: LoopSegment) {
    const isCurrent = isSegmentCurrent(track, segment);
    if (isCurrent && isPlaying) {
      setPlaying(false);
      return;
    }
    const item: PlayableItem = {
      track,
      workId,
      segment: {
        id: segment.id,
        name: segment.name,
        start: segment.start_sec,
        end: segment.end_sec,
      },
    };
    setTrackList([item]);
    setPlayableItem(item, 0);
    setPlaying(true);
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-400">{t('workDetail.savedSegments')}</h4>
      <div className="space-y-1">
        {allSegments.map(({ track, segment }) => {
          const isCurrent = isSegmentCurrent(track, segment);
          return (
            <PlayableItemRow
              key={segment.id}
              isCurrent={isCurrent}
              isPlaying={isPlaying}
              onClick={() => handleSegmentClick(track, segment)}
              showPlayWhenNotCurrent
              leadingSlot={
                <span
                  className={`flex-shrink-0 ${isCurrent ? 'text-accent' : 'text-accent/80'}`}
                  title={t('workDetail.loopSegment')}
                >
                  <Repeat size={14} />
                </span>
              }
              middleContent={
                <span className="flex items-center gap-2 min-w-0">
                  {editingId === segment.id ? (
                    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onBlur={commitEdit}
                        className="px-1.5 py-0.5 text-sm bg-dark-hover border border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-accent/50 w-32"
                      />
                      <button
                        onClick={commitEdit}
                        className="p-1 rounded text-accent hover:bg-accent/20"
                      >
                        <Check size={14} />
                      </button>
                    </span>
                  ) : (
                    <>
                      <span className="truncate">
                        {segment.name || t('player.segmentNameDefault')}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditing(segment); }}
                        className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-hover opacity-0 group-hover:opacity-100 transition-opacity"
                        title={t('workDetail.editName')}
                      >
                        <Pencil size={12} />
                      </button>
                    </>
                  )}
                  <span className="flex-shrink-0 text-gray-400 text-sm truncate max-w-[8rem]">
                    {track.title}
                  </span>
                </span>
              }
              trailingSlot={`${formatDuration(segment.start_sec)} → ${formatDuration(segment.end_sec)}`}
              actionsSlot={
                <div className="flex items-center gap-1">
                  <AddToPlaylistButton
                    trackId={track.id}
                    segmentStartSec={segment.start_sec}
                    segmentEndSec={segment.end_sec}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      api.deleteLoopSegment(segment.id).then(() => loadSegments()).catch(console.error);
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title={t('workDetail.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              }
            />
          );
        })}
      </div>
    </div>
  );
}
