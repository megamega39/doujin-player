import { Link, useLocation } from 'react-router-dom';
import {
  Library,
  Heart,
  Clock,
  ListMusic,
  Mic,
  CircleDot,
  Tag,
  Settings,
  X,
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useLayoutStore } from '../../stores/layoutStore';

const navPaths = [
  { path: '/', icon: Library, key: 'sidebar.library' as const },
  { path: '/favorites', icon: Heart, key: 'sidebar.favorites' as const },
  { path: '/recent', icon: Clock, key: 'sidebar.recent' as const },
  { path: '/playlists', icon: ListMusic, key: 'sidebar.playlists' as const },
  { path: '/voice-actors', icon: Mic, key: 'sidebar.voiceActors' as const },
  { path: '/circles', icon: CircleDot, key: 'sidebar.circles' as const },
  { path: '/tags', icon: Tag, key: 'sidebar.tags' as const },
  { path: '/settings', icon: Settings, key: 'sidebar.settings' as const },
];

export function Sidebar() {
  const location = useLocation();
  const { t } = useTranslation();
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
  const setSidebarOpen = useLayoutStore((s) => s.setSidebarOpen);

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
          {navPaths.map(({ path, icon: Icon, key }) => {
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
        </nav>
      </aside>
    </>
  );
}
