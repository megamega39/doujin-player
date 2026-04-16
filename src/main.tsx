import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { invoke } from '@tauri-apps/api/core';
import { useThemeStore, applyTheme } from './stores/themeStore';
import { usePlaybackSettingsStore } from './stores/playbackSettingsStore';
import { usePlayerStore } from './stores/playerStore';
import { useLanguageStore } from './stores/languageStore';
import { preloadMessages } from './i18n';

// ブラウザデフォル���の右クリックメニューを無効化
document.addEventListener('contextmenu', (e) => e.preventDefault());

// 起動時にテーマを適用
applyTheme(useThemeStore.getState());

// 起動時にデフォルトループモードを適用
const { defaultLoopMode } = usePlaybackSettingsStore.getState();
const ps = usePlayerStore.getState();
if (defaultLoopMode === 'playlist') {
  ps.setTrackLoopEnabled(false);
  ps.setPlaylistLoopEnabled(true);
} else if (defaultLoopMode === 'track') {
  ps.setPlaylistLoopEnabled(false);
  ps.setTrackLoopEnabled(true);
} else {
  ps.setTrackLoopEnabled(false);
  ps.setPlaylistLoopEnabled(false);
}

// 翻訳をプリロードしてからレンダリング
const initLocale = useLanguageStore.getState().locale;
preloadMessages(initLocale).then(() => {
  // ウィンドウタイトルを設定
  import(`./i18n/translations/${initLocale}.ts`)
    .then((mod) => {
      const messages = (mod.default ?? mod) as Record<string, unknown>;
      const title = (messages.appTitle as string) ?? '同人音声プレイヤー';
      invoke('set_window_title', { title }).catch(() => {});
    })
    .catch(() => {});

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}).catch(() => {
  // フォールバック: プリロード失敗でもレンダリングする
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
