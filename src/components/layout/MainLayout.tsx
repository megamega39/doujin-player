import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { MiniPlayer } from './MiniPlayer';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useLayoutStore } from '../../stores/layoutStore';
import { useTranslation } from '../../i18n';

export function MainLayout() {
  useShortcuts();
  const { t } = useTranslation();
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

  return (
    <div className="h-screen flex flex-col bg-dark-bg overflow-hidden">
      <div className="flex flex-1 min-h-0 min-w-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="md:hidden shrink-0 flex items-center gap-2 px-4 py-2 border-b border-dark-border bg-dark-card">
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-gray-400 hover:text-inherit hover:bg-dark-hover rounded"
              aria-label={t('sidebar.menu')}
            >
              <Menu size={22} />
            </button>
          </header>
          <div className="flex-1 min-h-0 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>
      <MiniPlayer />
    </div>
  );
}
