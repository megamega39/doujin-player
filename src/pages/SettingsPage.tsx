import { useState, useEffect } from 'react';
import { open, confirm } from '@tauri-apps/plugin-dialog';
import { api, type LibraryRoot } from '../api';
import { FolderOpen, Trash2, Keyboard, Languages, Minimize2, Check, Download } from 'lucide-react';
import { ShortcutSettingsModal } from '../components/settings/ShortcutSettingsModal';
import { useTranslation } from '../i18n';
import { useLanguageStore, SUPPORTED_LOCALES, type Locale } from '../stores/languageStore';
import { Sun, Moon, Play, Repeat, HelpCircle } from 'lucide-react';
import { useThemeStore, THEME_COLORS, applyAccentColor, applyThemeMode, type ThemeMode } from '../stores/themeStore';
import { usePlaybackSettingsStore, type DefaultLoopMode } from '../stores/playbackSettingsStore';
import { usePlayerStore } from '../stores/playerStore';
import { WelcomeGuide } from '../components/WelcomeGuide';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

export function SettingsPage() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLanguageStore();
  const { accentColorId, setAccentColorId, mode, setMode } = useThemeStore();
  const { autoPlayOnStart, setAutoPlayOnStart, defaultLoopMode, setDefaultLoopMode } = usePlaybackSettingsStore();
  const [shortcutModalOpen, setShortcutModalOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [roots, setRoots] = useState<LibraryRoot[]>([]);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [closeToTray, setCloseToTrayState] = useState(false);

  async function loadRoots() {
    try {
      const list = await api.getLibraryRoots();
      setRoots(list);
    } catch (e) {
      console.error('Failed to load library roots:', e);
    }
  }

  useEffect(() => {
    loadRoots();
  }, []);

  useEffect(() => {
    api.getCloseToTray().then(setCloseToTrayState).catch(() => {});
  }, []);

  async function handleCloseToTrayChange(enabled: boolean) {
    try {
      await api.setCloseToTray(enabled);
      setCloseToTrayState(enabled);
    } catch (e) {
      console.error('Failed to set close to tray:', e);
    }
  }

  async function handleSelectFolder() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t('settings.selectFolder'),
    });
    if (selected && typeof selected === 'string') {
      setScanning(true);
      setLastResult(null);
      try {
        const count = await api.scanLibrary(selected);
        setLastResult(t('settings.scanSuccess', { count }));
        await loadRoots();
      } catch (e) {
        setLastResult(t('settings.scanError', { message: String(e) }));
      } finally {
        setScanning(false);
      }
    }
  }

  async function handleRemove(root: LibraryRoot) {
    const ok = await confirm(t('settings.removeFolderConfirm', { path: root.path }), {
      title: t('settings.removeFolderTitle'),
      kind: 'warning',
    });
    if (!ok) return;
    try {
      await api.removeLibraryRoot(root.id);
      setLastResult(null);
      await loadRoots();
    } catch (e) {
      setLastResult(t('settings.removeError', { message: String(e) }));
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-2xl font-semibold mb-6">{t('settings.title')}</h2>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.library')}</h3>
        <p className="text-gray-400 text-sm mb-4">{t('settings.libraryDesc')}</p>
        <button
          onClick={handleSelectFolder}
          disabled={scanning}
          className="px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2"
        >
          <FolderOpen size={18} />
          {scanning ? t('settings.scanning') : t('settings.addFolder')}
        </button>
        {lastResult && (
          <p className="mt-3 text-sm text-gray-400">{lastResult}</p>
        )}

        {roots.length > 0 && (
          <ul className="mt-4 space-y-2">
            {roots.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2 px-3 bg-dark-card rounded-lg"
              >
                <span
                  className="text-sm text-gray-300 truncate flex-1"
                  title={r.path}
                >
                  {r.path}
                </span>
                <button
                  onClick={() => handleRemove(r)}
                  className="p-1.5 rounded hover:bg-dark-hover text-red-400 hover:text-red-300 transition-colors"
                  title={t('settings.removeFromLibrary')}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {roots.length === 0 && !scanning && (
          <p className="mt-4 text-sm text-gray-400">{t('settings.noFolders')}</p>
        )}
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.language')}</h3>
        <p className="text-gray-400 text-sm mb-4">{t('settings.languageDesc')}</p>
        <div className="flex items-center gap-2">
          <Languages size={18} className="text-gray-400" />
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {SUPPORTED_LOCALES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.closeToTray')}</h3>
        <p className="text-gray-400 text-sm mb-4">{t('settings.closeToTrayDesc')}</p>
        <button
          type="button"
          onClick={() => handleCloseToTrayChange(!closeToTray)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            closeToTray ? 'bg-accent text-white' : 'bg-dark-card hover:bg-dark-hover text-gray-300'
          }`}
        >
          <Minimize2 size={18} />
          {closeToTray ? t('settings.trayOn') : t('settings.trayOff')}
        </button>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.themeMode')}</h3>
        <p className="text-gray-400 text-sm mb-4">{t('settings.themeModeDesc')}</p>
        <div className="flex gap-2">
          {([
            { id: 'dark' as ThemeMode, icon: Moon, labelKey: 'settings.dark' },
            { id: 'light' as ThemeMode, icon: Sun, labelKey: 'settings.light' },
          ]).map(({ id, icon: Icon, labelKey }) => (
            <button
              key={id}
              onClick={() => {
                setMode(id);
                applyThemeMode(id);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                mode === id
                  ? 'bg-accent text-white'
                  : 'bg-dark-card hover:bg-dark-hover'
              }`}
            >
              <Icon size={18} />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.themeColor')}</h3>
        <p className="text-gray-400 text-sm mb-4">{t('settings.themeColorDesc')}</p>
        <div className="flex flex-wrap gap-3">
          {THEME_COLORS.map((color) => {
            const isSelected = accentColorId === color.id;
            return (
              <button
                key={color.id}
                onClick={() => {
                  setAccentColorId(color.id);
                  applyAccentColor(color.id);
                }}
                className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                  isSelected ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {isSelected && <Check size={16} className="text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.shortcuts')}</h3>
        <p className="text-gray-400 text-sm mb-4">{t('settings.shortcutsDesc')}</p>
        <button
          onClick={() => setShortcutModalOpen(true)}
          className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg font-medium flex items-center gap-2"
        >
          <Keyboard size={18} />
          {t('settings.shortcutSettings')}
        </button>
      </section>

      <section className="mb-8">
        <h3 className="text-lg font-medium mb-3">{t('settings.playback')}</h3>

        <div className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-3">{t('settings.autoPlayDesc')}</p>
            <button
              type="button"
              onClick={() => setAutoPlayOnStart(!autoPlayOnStart)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                autoPlayOnStart ? 'bg-accent text-white' : 'bg-dark-card hover:bg-dark-hover'
              }`}
            >
              <Play size={18} />
              {autoPlayOnStart ? t('settings.trayOn') : t('settings.trayOff')}
            </button>
          </div>

          <div>
            <p className="text-gray-400 text-sm mb-3">{t('settings.defaultLoopDesc')}</p>
            <div className="flex gap-2">
              {([
                { id: 'off' as DefaultLoopMode, labelKey: 'settings.loopOff' },
                { id: 'playlist' as DefaultLoopMode, labelKey: 'settings.loopPlaylist' },
                { id: 'track' as DefaultLoopMode, labelKey: 'settings.loopTrack' },
              ]).map(({ id, labelKey }) => (
                <button
                  key={id}
                  onClick={() => {
                    setDefaultLoopMode(id);
                    const ps = usePlayerStore.getState();
                    ps.setTrackLoopEnabled(id === 'track');
                    ps.setPlaylistLoopEnabled(id === 'playlist');
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    defaultLoopMode === id
                      ? 'bg-accent text-white'
                      : 'bg-dark-card hover:bg-dark-hover'
                  }`}
                >
                  <Repeat size={16} />
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <UpdateSection />

      <AboutSection />

      <section className="mb-8">
        <button
          onClick={() => setGuideOpen(true)}
          className="px-4 py-2 bg-dark-card border border-dark-border hover:bg-dark-hover rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <HelpCircle size={18} />
          {t('guide.openGuide')}
        </button>
      </section>

      {shortcutModalOpen && (
        <ShortcutSettingsModal onClose={() => setShortcutModalOpen(false)} />
      )}
      {guideOpen && (
        <WelcomeGuide onClose={() => setGuideOpen(false)} />
      )}
    </div>
  );
}

function useAppVersion() {
  const [version, setVersion] = useState('');
  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('?'));
  }, []);
  return version;
}

function UpdateSection() {
  const { t } = useTranslation();
  const version = useAppVersion();
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'done' | 'upToDate' | 'error'>('idle');
  const [newVersion, setNewVersion] = useState('');
  const [updateRef, setUpdateRef] = useState<Awaited<ReturnType<typeof check>> | null>(null);

  async function handleCheck() {
    setStatus('checking');
    try {
      const update = await check();
      if (update) {
        setNewVersion(update.version);
        setUpdateRef(update);
        setStatus('available');
      } else {
        setStatus('upToDate');
      }
    } catch {
      setStatus('error');
    }
  }

  async function handleDownload() {
    if (!updateRef) return;
    setStatus('downloading');
    try {
      await updateRef.downloadAndInstall();
      setStatus('done');
      await relaunch();
    } catch {
      setStatus('error');
    }
  }

  return (
    <section className="mb-8">
      <h3 className="text-lg font-medium mb-3">{t('settings.update')}</h3>
      <p className="text-gray-400 text-sm mb-2">{t('settings.updateDesc')}</p>
      <p className="text-gray-500 text-xs mb-4">{t('settings.currentVersion', { version })}</p>

      {status === 'idle' && (
        <button
          onClick={handleCheck}
          className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg font-medium flex items-center gap-2"
        >
          <Download size={18} />
          {t('settings.checkUpdate')}
        </button>
      )}
      {status === 'checking' && (
        <p className="text-gray-400 text-sm">{t('settings.checking')}</p>
      )}
      {status === 'available' && (
        <div className="space-y-2">
          <p className="text-sm text-accent font-medium">{t('settings.updateAvailable', { version: newVersion })}</p>
          <button
            onClick={handleDownload}
            className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg font-medium flex items-center gap-2"
          >
            <Download size={18} />
            {t('settings.downloadAndInstall')}
          </button>
        </div>
      )}
      {status === 'downloading' && (
        <p className="text-gray-400 text-sm">{t('settings.downloading')}</p>
      )}
      {status === 'done' && (
        <p className="text-green-400 text-sm">{t('settings.restartToApply')}</p>
      )}
      {status === 'upToDate' && (
        <div className="space-y-2">
          <p className="text-green-400 text-sm">{t('settings.upToDate')}</p>
          <button
            onClick={handleCheck}
            className="px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border rounded-lg text-sm flex items-center gap-2"
          >
            {t('settings.checkUpdate')}
          </button>
        </div>
      )}
      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-red-400 text-sm">{t('settings.updateError')}</p>
          <button
            onClick={handleCheck}
            className="px-3 py-1.5 bg-dark-card hover:bg-dark-hover border border-dark-border rounded-lg text-sm flex items-center gap-2"
          >
            {t('settings.checkUpdate')}
          </button>
        </div>
      )}
    </section>
  );
}

function AboutSection() {
  const { t } = useTranslation();
  const version = useAppVersion();

  return (
    <section className="mb-8">
      <h3 className="text-lg font-medium mb-3">{t('about.title')}</h3>
      <div className="p-4 bg-dark-card border border-dark-border rounded-lg space-y-2 text-sm">
        <p className="font-medium text-lg">{t('about.appName')}</p>
        <p className="text-gray-400">{t('about.version', { version })}</p>
        <p className="text-gray-400">{t('about.author')}</p>
        <p className="text-gray-400">
          {t('about.license')}
        </p>
        <p>
          <a
            href="https://github.com/megamega39/doujin-player"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            GitHub
          </a>
        </p>
      </div>
    </section>
  );
}
