import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';
import { api } from '../api';

export interface ScanProgress {
  current: number;
  total: number;
  current_title: string;
}

interface LibraryRescanState {
  inProgress: boolean;
  refreshTrigger: number;
  progress: ScanProgress | null;
  startRescan: () => Promise<void>;
}

// イベントリスナーを初期化
let progressUnlisten: (() => void) | null = null;

export const useLibraryRescanStore = create<LibraryRescanState>((set, get) => ({
  inProgress: false,
  refreshTrigger: 0,
  progress: null,

  startRescan: async () => {
    if (get().inProgress) return;
    set({ inProgress: true, progress: null });

    // 進捗イベントのリスナーを登録
    if (progressUnlisten) progressUnlisten();
    progressUnlisten = await listen<ScanProgress>('scan-progress', (event) => {
      set({ progress: event.payload });
    });

    try {
      await api.rescanLibrary();
      set((s) => ({ refreshTrigger: s.refreshTrigger + 1 }));
    } catch (e) {
      console.error('再スキャン失敗:', e);
    } finally {
      if (progressUnlisten) {
        progressUnlisten();
        progressUnlisten = null;
      }
      set({ inProgress: false, progress: null });
    }
  },
}));
