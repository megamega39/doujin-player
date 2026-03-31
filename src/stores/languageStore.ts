import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Locale = 'ja' | 'en' | 'zh-CN' | 'zh-TW' | 'ko' | 'es' | 'pt';

export interface LanguageState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'ko', label: '한국어' },
  { value: 'es', label: 'Español' },
  { value: 'pt', label: 'Português' },
];

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      locale: 'ja',
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'language-store' }
  )
);
