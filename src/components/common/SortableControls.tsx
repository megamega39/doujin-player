import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface SortableControlsProps {
  idx: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function SortableControls({ idx, total, onMoveUp, onMoveDown }: SortableControlsProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col flex-shrink-0 gap-0.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
          disabled={idx === 0}
          className="p-0.5 rounded text-gray-400 hover:text-gray-300 hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title={t('playlists.moveUp')}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
          disabled={idx === total - 1}
          className="p-0.5 rounded text-gray-400 hover:text-gray-300 hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          title={t('playlists.moveDown')}
        >
          <ChevronDown size={14} />
        </button>
    </div>
  );
}
