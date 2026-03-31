const MODIFIER_KEYS = new Set(['control', 'alt', 'shift', 'meta']);
const MODIFIER_KEYS_ALT = new Set(['ctrl', 'alt', 'shift', 'meta']);

/**
 * キーボードイベントをショートカット文字列に正規化
 * 例: "ctrl+k", "alt+shift+space", " "
 */
export function eventToShortcutKey(e: KeyboardEvent): string {
  if (MODIFIER_KEYS.has(e.key.toLowerCase())) return '';
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('ctrl');
  if (e.altKey) parts.push('alt');
  if (e.shiftKey) parts.push('shift');
  if (e.metaKey) parts.push('meta');

  let key = e.key;
  if (key === ' ') key = 'space';
  else if (key.length === 1) key = key.toLowerCase();
  else key = key.toLowerCase();

  if (MODIFIER_KEYS_ALT.has(key)) return '';
  parts.push(key);
  return parts.join('+');
}

/**
 * ショートカットキーを表示用にフォーマット
 */
export function formatShortcutKey(shortcut: string): string {
  if (!shortcut) return '—';
  return shortcut
    .split('+')
    .map((k) => {
      const map: Record<string, string> = {
        ctrl: 'Ctrl',
        alt: 'Alt',
        shift: 'Shift',
        meta: 'Meta',
        ' ': 'Space',
        space: 'Space',
        arrowup: '↑',
        arrowdown: '↓',
        arrowleft: '←',
        arrowright: '→',
        '[': '[',
        ']': ']',
        '\\': '\\',
      };
      return map[k.toLowerCase()] ?? k.charAt(0).toUpperCase() + k.slice(1);
    })
    .join(' + ');
}

/**
 * ラベルにショートカットキーを付加する
 * 例: "再生 / 一時停止" + "space" → "再生 / 一時停止 (Space)"
 */
export function labelWithShortcut(label: string, shortcutKeys: string | undefined): string {
  if (!shortcutKeys) return label;
  return `${label} (${formatShortcutKey(shortcutKeys)})`;
}
