import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Music, Film, BarChart3 } from 'lucide-react';
import { WorkGridPage } from './WorkGridPage';
import { api, type FavoriteTrackItem, type PlayableItem } from '../api';
import { useTranslation } from '../i18n';
import { usePlayerStore } from '../stores/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { isVideoTrack } from '../utils/media';
import { formatDuration } from '../utils/format';

export function RecentPage() {
  const { t } = useTranslation();
  const [showStats, setShowStats] = useState(false);

  return (
    <div>
      <div className="px-6 pt-6 flex items-center gap-4">
        <h2 className="text-2xl font-semibold">{t('sidebar.recent')}</h2>
        <button
          onClick={() => setShowStats(!showStats)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            showStats ? 'bg-accent text-white' : 'bg-dark-card border border-dark-border hover:bg-dark-hover'
          }`}
        >
          <BarChart3 size={16} />
          {t('recent.stats')}
        </button>
      </div>
      {showStats && <MostPlayedSection />}
      <WorkGridPage titleKey="" filterRecent showSort />
    </div>
  );
}

function MostPlayedSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState<FavoriteTrackItem[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    currentTrack,
    isPlaying,
    setCurrentTrack,
    setPlaying,
    setTrackList,
    setLoopSegment,
    setLoopEnabled,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      setCurrentTrack: s.setCurrentTrack,
      setPlaying: s.setPlaying,
      setTrackList: s.setTrackList,
      setLoopSegment: s.setLoopSegment,
      setLoopEnabled: s.setLoopEnabled,
    }))
  );

  useEffect(() => {
    setLoading(true);
    api.getMostPlayedTracks(10)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePlay = useCallback((item: FavoriteTrackItem, idx: number) => {
    if (currentTrack?.id === item.track.id && isPlaying) {
      setPlaying(false);
      return;
    }
    setLoopSegment(null);
    setLoopEnabled(false);
    const playable: PlayableItem[] = items.map((it) => ({ track: it.track, workId: it.work_id }));
    setTrackList(playable);
    setCurrentTrack(item.track, idx);
    setPlaying(true);
  }, [currentTrack?.id, isPlaying, items, setCurrentTrack, setPlaying, setTrackList, setLoopSegment, setLoopEnabled]);

  if (loading) return <div className="px-6 py-4 text-gray-400">{t('loading')}</div>;
  if (items.length === 0) return <div className="px-6 py-4 text-gray-400">{t('recent.noStats')}</div>;

  return (
    <div className="px-6 py-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">{t('recent.mostPlayed')}</h3>
      <div className="space-y-1">
        {items.map((item, idx) => {
          const isCurrent = currentTrack?.id === item.track.id;
          const isVideo = isVideoTrack(item.track.file_path);
          return (
            <div
              key={item.track.id}
              onClick={() => handlePlay(item, idx)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group ${
                isCurrent && isPlaying
                  ? 'bg-accent/20 border border-accent/50'
                  : isCurrent
                    ? 'bg-accent/10 border border-accent/30'
                    : 'bg-dark-card hover:bg-dark-hover border border-transparent'
              }`}
            >
              <span className="w-6 text-right text-gray-400 text-sm font-mono">{idx + 1}</span>
              <span className="flex-shrink-0 text-gray-400">
                {isVideo ? <Film size={14} /> : <Music size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm">{item.track.title}</div>
                <Link
                  to={`/work/${item.work_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-gray-400 hover:text-accent truncate block"
                >
                  {item.work_title}
                </Link>
              </div>
              <span className="flex-shrink-0 text-gray-400 text-sm font-mono tabular-nums">
                {formatDuration(item.track.duration_sec)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
