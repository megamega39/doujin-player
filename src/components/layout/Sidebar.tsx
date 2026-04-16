import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Library,
  Heart,
  Clock,
  ListMusic,
  Mic,
  CircleDot,
  Tag,
  Dice5,
  Settings,
  X,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLayoutStore } from '../../stores/layoutStore';
import { usePlayerStore } from '../../stores/playerStore';
import { api, type PlayableItem } from '../../api';

const navPathsTop = [
  { path: '/', icon: Library, key: 'sidebar.library' as const },
  { path: '/favorites', icon: Heart, key: 'sidebar.favorites' as const },
  { path: '/recent', icon: Clock, key: 'sidebar.recent' as const },
  { path: '/playlists', icon: ListMusic, key: 'sidebar.playlists' as const },
  { path: '/voice-actors', icon: Mic, key: 'sidebar.voiceActors' as const },
  { path: '/circles', icon: CircleDot, key: 'sidebar.circles' as const },
  { path: '/tags', icon: Tag, key: 'sidebar.tags' as const },
];

const navPathsBottom = [
  { path: '/settings', icon: Settings, key: 'sidebar.settings' as const },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);
  const setCurrentTrack = usePlayerStore((s) => s.setCurrentTrack);
  const setTrackList = usePlayerStore((s) => s.setTrackList);
  const setPlaying = usePlayerStore((s) => s.setPlaying);
  const [randomLoading, setRandomLoading] = useState(false);

  const handleRandomPlay = async () => {
    if (randomLoading) return;
    setRandomLoading(true);
    try {
      const works = await api.getWorks();
      if (works.length === 0) return;
      const work = works[Math.floor(Math.random() * works.length)];
      const detail = await api.getWorkDetail(work.id);
      if (!detail) return;
      const defaultVariant = detail.variants.find((v) => v.is_default) ?? detail.variants[0];
      if (!defaultVariant) return;
      const tracks = await api.getTracks(defaultVariant.id);
      if (tracks.length === 0) return;
      const playable: PlayableItem[] = tracks.map((tr) => ({ track: tr, workId: work.id }));
      setTrackList(playable);
      setCurrentTrack(tracks[0], 0);
      setPlaying(true);
      setSidebarOpen(false);
      navigate(`/work/${work.id}`);
    } catch (err) {
      console.error('Random play failed:', err);
    } finally {
      setRandomLoading(false);
    }
  };

  return (
    <>
      {/* オーバーレイ: 小窓でメニューを開いているときの背景（クリックで閉じる） */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`
          w-48 bg-dark-card border-r border-dark-border flex flex-col shrink-0
          fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ease-out
          md:relative md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* モバイル時のみ閉じるボタン */}
        <div className="p-2 flex items-center justify-end md:hidden border-b border-dark-border">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-gray-400 hover:text-inherit hover:bg-dark-hover rounded"
            aria-label={t('sidebar.close')}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 p-2 pt-3 overflow-y-auto">
          {navPathsTop.map(({ path, icon: Icon, key }) => {
            const isActive =
              path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-300 hover:bg-dark-hover hover:text-inherit'
                }`}
              >
                <Icon size={20} />
                <span>{t(key)}</span>
              </Link>
            );
          })}
          <button
            onClick={handleRandomPlay}
            disabled={randomLoading}
            className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors text-gray-300 hover:bg-dark-hover hover:text-inherit disabled:opacity-50 w-full text-left"
          >
            <Dice5 size={20} />
            <span>{t('player.randomPlay')}</span>
          </button>
          {navPathsBottom.map(({ path, icon: Icon, key }) => {
            const isActive = location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                  isActive
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-300 hover:bg-dark-hover hover:text-inherit'
                }`}
              >
                <Icon size={20} />
                <span>{t(key)}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
