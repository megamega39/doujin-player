import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ShortcutDef {
  id: string;
  /** 翻訳キー (i18n) */
  labelKey: string;
  defaultKeys: string;
}

export const SHORTCUT_DEFINITIONS: ShortcutDef[] = [
  { id: 'play_pause', labelKey: 'shortcuts.playPause', defaultKeys: 'space' },
  { id: 'seek_forward_small', labelKey: 'shortcuts.seekForwardSmall', defaultKeys: 'shift+arrowright' },
  { id: 'seek_backward_small', labelKey: 'shortcuts.seekBackwardSmall', defaultKeys: 'shift+arrowleft' },
  { id: 'seek_forward', labelKey: 'shortcuts.seekForward', defaultKeys: 'l' },
  { id: 'seek_backward', labelKey: 'shortcuts.seekBackward', defaultKeys: 'j' },
  { id: 'seek_forward_more', labelKey: 'shortcuts.seekForwardMore', defaultKeys: 'shift+l' },
  { id: 'seek_backward_more', labelKey: 'shortcuts.seekBackwardMore', defaultKeys: 'shift+j' },
  { id: 'prev_track', labelKey: 'shortcuts.prevTrack', defaultKeys: 'arrowleft' },
  { id: 'next_track', labelKey: 'shortcuts.nextTrack', defaultKeys: 'arrowright' },
  { id: 'mute', labelKey: 'shortcuts.mute', defaultKeys: 'm' },
  { id: 'volume_up', labelKey: 'shortcuts.volumeUp', defaultKeys: 'arrowup' },
  { id: 'volume_down', labelKey: 'shortcuts.volumeDown', defaultKeys: 'arrowdown' },
  { id: 'set_loop_a', labelKey: 'shortcuts.setLoopA', defaultKeys: '[' },
  { id: 'set_loop_b', labelKey: 'shortcuts.setLoopB', defaultKeys: ']' },
  { id: 'toggle_loop', labelKey: 'shortcuts.toggleLoop', defaultKeys: '\\' },
];

export interface ShortcutState {
  shortcuts: Record<string, string>;
  setShortcut: (id: string, keys: string) => void;
  resetShortcut: (id: string) => void;
  resetAll: () => void;
  getKeys: (id: string) => string;
}

const defaultShortcuts: Record<string, string> = {};
SHORTCUT_DEFINITIONS.forEach((def) => {
  defaultShortcuts[def.id] = def.defaultKeys;
});

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set, get) => ({
      shortcuts: { ...defaultShortcuts },
      setShortcut: (id, keys) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [id]: keys },
        })),
      resetShortcut: (id) => {
        const def = SHORTCUT_DEFINITIONS.find((d) => d.id === id);
        if (def) {
          set((state) => ({
            shortcuts: { ...state.shortcuts, [id]: def.defaultKeys },
          }));
        }
      },
      resetAll: () =>
        set({
          shortcuts: { ...defaultShortcuts },
        }),
      getKeys: (id) => get().shortcuts[id] ?? SHORTCUT_DEFINITIONS.find((d) => d.id === id)?.defaultKeys ?? '',
    }),
    { name: 'shortcuts' }
  )
);
