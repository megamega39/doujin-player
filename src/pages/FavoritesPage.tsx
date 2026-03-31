import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Music, Film } from 'lucide-react';
import { WorkGridPage } from './WorkGridPage';
import { api, type FavoriteTrackItem, type PlayableItem } from '../api';
import { useTranslation } from '../i18n';
import { usePlayerStore } from '../stores/playerStore';
import { useShallow } from 'zustand/react/shallow';
import { isVideoTrack } from '../utils/media';
import { formatDuration } from '../utils/format';

type Tab = 'works' | 'tracks';

export function FavoritesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('works');

  return (
    <div>
      <div className="px-6 pt-6 flex items-center gap-4">
        <h2 className="text-2xl font-semibold">{t('sidebar.favorites')}</h2>
        <div className="flex gap-1 ml-4">
          <button
            onClick={() => setTab('works')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'works' ? 'bg-accent text-white' : 'bg-dark-card text-gray-300 hover:bg-dark-hover'
            }`}
          >
            {t('favorites.works')}
          </button>
          <button
            onClick={() => setTab('tracks')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === 'tracks' ? 'bg-accent text-white' : 'bg-dark-card text-gray-300 hover:bg-dark-hover'
            }`}
          >
            {t('favorites.tracks')}
          </button>
        </div>
      </div>
      {tab === 'works' ? (
        <WorkGridPage titleKey="" filterFavorite showSort />
      ) : (
        <FavoriteTracksTab />
      )}
    </div>
  );
}

function FavoriteTracksTab() {
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

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getFavoriteTracks();
      setItems(data);
    } catch (e) {
      console.error('Failed to load favorite tracks:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handlePlay = (item: FavoriteTrackItem, idx: number) => {
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
  };

  const handleToggleFavorite = async (trackId: string) => {
    await api.toggleTrackFavorite(trackId);
    loadFavorites();
  };

  if (loading) {
    return <div className="px-6 py-8 text-gray-400">{t('loading')}</div>;
  }

  if (items.length === 0) {
    return <div className="px-6 py-8 text-gray-400">{t('favorites.noTracks')}</div>;
  }

  return (
    <div className="px-6 py-4 space-y-1">
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
            <button
              onClick={(e) => { e.stopPropagation(); handleToggleFavorite(item.track.id); }}
              className="p-1.5 rounded-full text-red-500 hover:text-red-400 transition-colors flex-shrink-0"
            >
              <Heart size={14} fill="currentColor" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
