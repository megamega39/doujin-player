import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WelcomeGuide } from './components/WelcomeGuide';
import { useLanguageStore } from './stores/languageStore';
import { useTranslation } from './i18n';
import { api } from './api';
import { PlaylistDetailPage } from './pages/PlaylistDetailPage';

const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage').then((m) => ({ default: m.FavoritesPage })));
const RecentPage = lazy(() => import('./pages/RecentPage').then((m) => ({ default: m.RecentPage })));
const TagsPage = lazy(() => import('./pages/TagsPage').then((m) => ({ default: m.TagsPage })));
const VoiceActorsPage = lazy(() => import('./pages/VoiceActorsPage').then((m) => ({ default: m.VoiceActorsPage })));
const CirclesPage = lazy(() => import('./pages/CirclesPage').then((m) => ({ default: m.CirclesPage })));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage').then((m) => ({ default: m.PlaylistsPage })));
const WorkDetailPage = lazy(() => import('./pages/WorkDetailPage').then((m) => ({ default: m.WorkDetailPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 items-center justify-center text-gray-400">
      {t('loading')}
    </div>
  );
}

const GUIDE_SHOWN_KEY = 'welcome-guide-shown';

function App() {
  const locale = useLanguageStore((s) => s.locale);
  const { t } = useTranslation();
  const [showGuide, setShowGuide] = useState(() => {
    return !localStorage.getItem(GUIDE_SHOWN_KEY);
  });

  useEffect(() => {
    document.documentElement.lang = locale;
    const title = t('appTitle');
    if (title && title !== 'appTitle') {
      api.setWindowTitle(title).catch(console.error);
    }
  }, [locale, t]);

  const handleCloseGuide = () => {
    setShowGuide(false);
    localStorage.setItem(GUIDE_SHOWN_KEY, '1');
  };

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route
              index
              element={
                <Suspense fallback={<PageFallback />}>
                  <LibraryPage />
                </Suspense>
              }
            />
            <Route
              path="favorites"
              element={
                <Suspense fallback={<PageFallback />}>
                  <FavoritesPage />
                </Suspense>
              }
            />
            <Route
              path="recent"
              element={
                <Suspense fallback={<PageFallback />}>
                  <RecentPage />
                </Suspense>
              }
            />
            <Route
              path="voice-actors"
              element={
                <Suspense fallback={<PageFallback />}>
                  <VoiceActorsPage />
                </Suspense>
              }
            />
            <Route
              path="circles"
              element={
                <Suspense fallback={<PageFallback />}>
                  <CirclesPage />
                </Suspense>
              }
            />
            <Route
              path="tags"
              element={
                <Suspense fallback={<PageFallback />}>
                  <TagsPage />
                </Suspense>
              }
            />
            <Route
              path="playlists"
              element={
                <Suspense fallback={<PageFallback />}>
                  <PlaylistsPage />
                </Suspense>
              }
            />
            <Route path="playlists/:id" element={<PlaylistDetailPage />} />
            <Route
              path="settings"
              element={
                <Suspense fallback={<PageFallback />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route
              path="work/:id"
              element={
                <Suspense fallback={<PageFallback />}>
                  <WorkDetailPage />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </HashRouter>
      {showGuide && <WelcomeGuide onClose={handleCloseGuide} />}
    </ErrorBoundary>
  );
}

export default App;
