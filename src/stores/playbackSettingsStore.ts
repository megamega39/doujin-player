import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DefaultLoopMode = 'off' | 'playlist' | 'track';

interface PlaybackSettingsState {
  autoPlayOnStart: boolean;
  defaultLoopMode: DefaultLoopMode;
  setAutoPlayOnStart: (v: boolean) => void;
  setDefaultLoopMode: (v: DefaultLoopMode) => void;
}

export const usePlaybackSettingsStore = create<PlaybackSettingsState>()(
  persist(
    (set) => ({
      autoPlayOnStart: false,
      defaultLoopMode: 'playlist',
      setAutoPlayOnStart: (v) => set({ autoPlayOnStart: v }),
      setDefaultLoopMode: (v) => set({ defaultLoopMode: v }),
    }),
    { name: 'playback-settings' }
  )
);
