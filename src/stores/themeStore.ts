import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'dark' | 'light';

export interface ThemeColor {
  id: string;
  name: string;
  hex: string;
  rgb: string;
}

export const THEME_COLORS: ThemeColor[] = [
  { id: 'indigo', name: 'Indigo', hex: '#6366f1', rgb: '99 102 241' },
  { id: 'blue', name: 'Blue', hex: '#3b82f6', rgb: '59 130 246' },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4', rgb: '6 182 212' },
  { id: 'emerald', name: 'Emerald', hex: '#10b981', rgb: '16 185 129' },
  { id: 'amber', name: 'Amber', hex: '#f59e0b', rgb: '245 158 11' },
  { id: 'rose', name: 'Rose', hex: '#f43f5e', rgb: '244 63 94' },
  { id: 'purple', name: 'Purple', hex: '#a855f7', rgb: '168 85 247' },
  { id: 'pink', name: 'Pink', hex: '#ec4899', rgb: '236 72 153' },
];

interface ThemeState {
  accentColorId: string;
  mode: ThemeMode;
  setAccentColorId: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      accentColorId: 'indigo',
      mode: 'dark' as ThemeMode,
      setAccentColorId: (id) => set({ accentColorId: id }),
      setMode: (mode) => set({ mode }),
    }),
    { name: 'theme-settings' }
  )
);

/** アクセントカラーを適用 */
export function applyAccentColor(colorId: string) {
  const color = THEME_COLORS.find((c) => c.id === colorId) ?? THEME_COLORS[0];
  document.documentElement.style.setProperty('--color-accent-rgb', color!.rgb);
}

/** テーマモードを適用 */
export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'light') {
    root.classList.add('light');
  } else {
    root.classList.remove('light');
  }
}

/** テーマ全体を適用 */
export function applyTheme(state: { accentColorId: string; mode: ThemeMode }) {
  applyAccentColor(state.accentColorId);
  applyThemeMode(state.mode);
}
