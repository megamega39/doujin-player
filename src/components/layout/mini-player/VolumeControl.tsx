import { Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from '../../../i18n';
import { useShortcutStore } from '../../../stores/shortcutStore';
import { labelWithShortcut } from '../../../utils/shortcutKey';

interface VolumeControlProps {
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onMuteToggle: () => void;
}

export function VolumeControl({
  volume,
  muted,
  onVolumeChange,
  onMuteToggle,
}: VolumeControlProps) {
  const { t } = useTranslation();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const tip = (label: string, id: string) => labelWithShortcut(label, shortcuts[id]);
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onMuteToggle}
        className="p-1.5 rounded-md hover:bg-dark-hover text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
        title={tip(muted ? t('player.unmute') : t('player.mute'), 'mute')}
      >
        {muted ? (
          <VolumeX size={18} />
        ) : (
          <Volume2 size={18} />
        )}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="w-20 h-1.5 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
        title={t('player.volume')}
      />
      <span
        className="text-xs text-gray-400 tabular-nums min-w-[3rem]"
        title={t('player.volume')}
      >
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}
