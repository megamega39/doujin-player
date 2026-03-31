import { useState, useEffect } from 'react';
import { Repeat, ChevronLeft, ChevronRight, Save, X } from 'lucide-react';
import { formatDuration } from '../../../utils/format';
import { useTranslation } from '../../../i18n';
import { useShortcutStore } from '../../../stores/shortcutStore';
import { labelWithShortcut } from '../../../utils/shortcutKey';

interface LoopControlsProps {
  loopSegment: { start: number; end: number } | null;
  loopEnabled: boolean;
  onLoopToggle: () => void;
  onSetA: () => void;
  onSetB: () => void;
  onAdjustA?: (delta: number) => void;
  onAdjustB?: (delta: number) => void;
  onClearSegment?: () => void;
  onSaveSegment?: () => void;
}

export function LoopControls({
  loopSegment,
  loopEnabled,
  onLoopToggle,
  onSetA,
  onSetB,
  onAdjustA,
  onAdjustB,
  onClearSegment,
  onSaveSegment,
}: LoopControlsProps) {
  const { t } = useTranslation();
  const shortcuts = useShortcutStore((s) => s.shortcuts);
  const tip = (label: string, id: string) => labelWithShortcut(label, shortcuts[id]);
  const [expanded, setExpanded] = useState(false);

  // 区間がクリアされたら展開を閉じる
  useEffect(() => {
    if (!loopSegment) setExpanded(false);
  }, [loopSegment]);

  const hasSegment = loopSegment != null && loopSegment.start < loopSegment.end;

  // 未展開 & 区間未設定: コンパクトな「ループ区間」ボタンだけ
  if (!expanded && !hasSegment) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-300 bg-dark-hover/50 hover:bg-dark-hover transition-colors"
        title={t('player.loopSegmentHint')}
      >
        <Repeat size={12} />
        {t('player.loopSegmentLabel')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {/* ループON/OFF */}
      <button
        onClick={onLoopToggle}
        disabled={!hasSegment}
        className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
          loopEnabled
            ? 'bg-accent text-white'
            : 'bg-dark-hover/50 text-gray-400 hover:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed'
        }`}
        title={tip(t('player.loopSegmentHint'), 'toggle_loop')}
      >
        <Repeat size={12} />
        {loopEnabled ? 'ON' : 'OFF'}
      </button>

      {/* A点 */}
      <div className="flex items-center">
        {hasSegment && onAdjustA && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustA(-0.5); }}
            className="px-0.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-l"
          >
            <ChevronLeft size={12} />
          </button>
        )}
        <button
          onClick={onSetA}
          className={`px-2 py-1 text-xs tabular-nums ${
            loopSegment ? 'bg-dark-hover/50 hover:bg-dark-hover text-gray-300' : 'bg-dark-hover/30 hover:bg-dark-hover text-gray-400'
          }`}
          title={tip(t('player.pointA'), 'set_loop_a')}
        >
          A {loopSegment ? formatDuration(loopSegment.start) : '--:--'}
        </button>
        {hasSegment && onAdjustA && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustA(0.5); }}
            className="px-0.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-r"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* B点 */}
      <div className="flex items-center">
        {hasSegment && onAdjustB && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustB(-0.5); }}
            className="px-0.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-l"
          >
            <ChevronLeft size={12} />
          </button>
        )}
        <button
          onClick={onSetB}
          className={`px-2 py-1 text-xs tabular-nums ${
            loopSegment ? 'bg-dark-hover/50 hover:bg-dark-hover text-gray-300' : 'bg-dark-hover/30 hover:bg-dark-hover text-gray-400'
          }`}
          title={tip(t('player.pointB'), 'set_loop_b')}
        >
          B {loopSegment && loopSegment.end > 0 ? formatDuration(loopSegment.end) : '--:--'}
        </button>
        {hasSegment && onAdjustB && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdjustB(0.5); }}
            className="px-0.5 py-1 text-gray-400 hover:text-gray-200 hover:bg-dark-hover rounded-r"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {/* 保存・クリアボタン */}
      {hasSegment && (
        <>
          {onSaveSegment && (
            <button
              onClick={(e) => { e.stopPropagation(); onSaveSegment(); }}
              className="p-1 rounded text-accent hover:bg-accent/20"
              title={t('player.saveSegment')}
            >
              <Save size={14} />
            </button>
          )}
          {onClearSegment && (
            <button
              onClick={(e) => { e.stopPropagation(); onClearSegment(); }}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-hover"
              title={t('player.clearSegment')}
            >
              <X size={14} />
            </button>
          )}
          <span className="text-xs text-gray-400 tabular-nums">
            {formatDuration(loopSegment!.start)} → {formatDuration(loopSegment!.end)}
          </span>
        </>
      )}

      {/* 閉じるボタン（区間未設定時のみ） */}
      {!hasSegment && (
        <button
          onClick={() => setExpanded(false)}
          className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-dark-hover"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
