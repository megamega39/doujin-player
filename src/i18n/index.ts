import { useCallback, useState, useEffect } from 'react';
import { useLanguageStore, type Locale } from '../stores/languageStore';

export type { Locale };

type Messages = Record<string, unknown>;

/** ロケールごとに動的インポート（使用言語のみ読み込む） */
async function loadMessages(locale: Locale): Promise<Messages> {
  const mod = await import(`./translations/${locale}.ts`);
  return (mod.default ?? mod) as Messages;
}

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = params[key];
    return val != null ? String(val) : `{{${key}}}`;
  });
}

/** ロード済みメッセージのキャッシュ（translate 用） */
let messagesCache: Partial<Record<Locale, Messages>> = {};

/** 指定ロケールの翻訳をプリロード（起動時に呼ぶ） */
export async function preloadMessages(locale: Locale): Promise<void> {
  if (messagesCache[locale]) return;
  const m = await loadMessages(locale);
  messagesCache[locale] = m;
}

/** フック外で使用する翻訳関数（ロード済みキャッシュを使用） */
export function translate(
  key: string,
  params?: Record<string, string | number>,
  locale?: Locale
): string {
  const loc = locale ?? useLanguageStore.getState().locale;
  const messages = messagesCache[loc] ?? messagesCache.ja;
  if (!messages) return key;
  const msg = getNested(messages as Record<string, unknown>, key);
  const str = msg ?? key;
  return params ? interpolate(str, params) : str;
}

export function useTranslation() {
  const locale = useLanguageStore((s) => s.locale);
  const [messages, setMessages] = useState<Messages | null>(() => messagesCache[locale] ?? null);

  useEffect(() => {
    let cancelled = false;
    const cached = messagesCache[locale];
    if (cached) {
      setMessages(cached);
      return;
    }
    loadMessages(locale).then((m) => {
      if (!cancelled) {
        messagesCache[locale] = m;
        setMessages(m);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      if (!messages) return key;
      const msg = getNested(messages as Record<string, unknown>, key);
      const str = msg ?? key;
      return params ? interpolate(str, params) : str;
    },
    [messages]
  );

  return { t, locale };
}
