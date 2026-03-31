import { useEffect, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useShortcutStore, SHORTCUT_DEFINITIONS } from '../../stores/shortcutStore';
import { eventToShortcutKey, formatShortcutKey } from '../../utils/shortcutKey';
import { useTranslation } from '../../i18n';

interface ShortcutSettingsModalProps {
  onClose: () => void;
}

export function ShortcutSettingsModal({ onClose }: ShortcutSettingsModalProps) {
  const { t } = useTranslation();
  const { setShortcut, resetShortcut, resetAll, getKeys } = useShortcutStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setEditingId(null);
        setConflictId(null);
        return;
      }
      if (editingId) {
        e.preventDefault();
        const keys = eventToShortcutKey(e);
        if (!keys) return;
        const existing = SHORTCUT_DEFINITIONS.find(
          (def) => def.id !== editingId && getKeys(def.id) === keys
        );
        if (existing) {
          setConflictId(existing.id);
          return;
        }
        setConflictId(null);
        setShortcut(editingId, keys);
        setEditingId(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingId, setShortcut, getKeys]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-dark-card border border-dark-border rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border">
          <h2 className="text-lg font-semibold">{t('shortcutModal.title')}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-inherit transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-2">
          {SHORTCUT_DEFINITIONS.map((def) => (
            <ShortcutRow
              key={def.id}
              label={t(def.labelKey)}
              currentKeys={getKeys(def.id)}
              isEditing={editingId === def.id}
              hasConflict={conflictId === def.id}
              onStartEdit={() => {
                setEditingId(def.id);
                setConflictId(null);
              }}
              onReset={() => resetShortcut(def.id)}
              pressKeyHint={t('shortcutModal.pressKey')}
              resetTitle={t('shortcutModal.resetToDefault')}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-dark-border">
          <button
            onClick={resetAll}
            className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-inherit hover:bg-dark-hover transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={14} />
            {t('shortcutModal.resetAll')}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent/80 text-white text-sm font-medium"
          >
            {t('shortcutModal.close')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({
  label,
  currentKeys,
  isEditing,
  hasConflict,
  onStartEdit,
  onReset,
  pressKeyHint,
  resetTitle,
}: {
  label: string;
  currentKeys: string;
  isEditing: boolean;
  hasConflict: boolean;
  onStartEdit: () => void;
  onReset: () => void;
  pressKeyHint: string;
  resetTitle: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg hover:bg-dark-hover/50">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onStartEdit}
          className={`w-[140px] min-w-[140px] px-3 py-1.5 rounded text-sm text-left font-mono transition-colors ${
            isEditing
              ? 'bg-accent/30 text-accent ring-1 ring-accent'
              : hasConflict
                ? 'bg-red-500/20 text-red-400'
                : 'bg-dark-bg hover:bg-dark-border text-gray-300'
          }`}
        >
          {isEditing ? pressKeyHint : formatShortcutKey(currentKeys)}
        </button>
        <button
          onClick={onReset}
          className="p-1.5 rounded text-gray-400 hover:text-gray-300 hover:bg-dark-hover transition-colors"
          title={resetTitle}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
}
