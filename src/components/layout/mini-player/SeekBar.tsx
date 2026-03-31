import { useRef, useCallback } from 'react';
import { formatDuration } from '../../../utils/format';

interface SeekBarProps {
  currentTime: number;
  duration: number;
  seekPreviewTime: number | null;
  loopSegment?: { start: number; end: number } | null;
  loopEnabled?: boolean;
  onSeek: (time: number) => void;
  onSeekPreview: (time: number | null) => void;
}

export function SeekBar({
  currentTime,
  duration,
  seekPreviewTime,
  loopSegment,
  loopEnabled,
  onSeek,
  onSeekPreview,
}: SeekBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const time = seekPreviewTime ?? currentTime;
  const dur = duration && isFinite(duration) && duration > 0 ? duration : 0;
  const progress = dur > 0 ? (time / dur) * 100 : 0;

  // 区間ハイライトの位置計算（0〜100%にクランプ）
  const segStartPct = loopSegment && dur > 0 ? Math.max(0, Math.min(100, (loopSegment.start / dur) * 100)) : 0;
  const segEndPct = loopSegment && dur > 0 ? Math.max(0, Math.min(100, (loopSegment.end / dur) * 100)) : 0;
  const segWidthPct = segEndPct - segStartPct;
  const showSegment = loopEnabled && loopSegment && loopSegment.start < loopSegment.end && dur > 0 && segWidthPct > 0;

  const clientXToTime = useCallback(
    (clientX: number): number | null => {
      const bar = barRef.current;
      if (!bar || !dur || !isFinite(dur) || dur <= 0) return null;
      const rect = bar.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return percent * dur;
    },
    [dur]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const t = clientXToTime(e.clientX);
      if (t != null) onSeek(t);
    },
    [clientXToTime, onSeek]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      let lastPreviewTime: number | null = clientXToTime(e.clientX);
      if (lastPreviewTime != null) onSeekPreview(lastPreviewTime);
      let rafId: number | null = null;
      let pendingX: number | null = null;
      const onMouseMove = (ev: MouseEvent) => {
        pendingX = ev.clientX;
        if (rafId == null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            if (pendingX != null) {
              const newT = clientXToTime(pendingX);
              if (newT != null) {
                lastPreviewTime = newT;
                onSeekPreview(newT);
              }
              pendingX = null;
            }
          });
        }
      };
      const onMouseUp = () => {
        if (rafId != null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        if (pendingX != null) {
          const t = clientXToTime(pendingX);
          if (t != null) lastPreviewTime = t;
          pendingX = null;
        }
        onSeekPreview(null);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        if (lastPreviewTime != null) onSeek(lastPreviewTime);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [clientXToTime, onSeek, onSeekPreview]
  );

  return (
    <div
      className="flex items-center gap-2 w-full max-w-2xl cursor-pointer select-none"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      <span className="text-xs text-gray-400 tabular-nums min-w-[2.5rem] flex-shrink-0 text-right">
        {formatDuration(time)}
      </span>
      <div
        ref={barRef}
        className="flex-1 min-w-0 h-1.5 bg-dark-border hover:bg-dark-hover rounded-full relative transition-colors"
      >
        {/* 区間ハイライト */}
        {showSegment && (
          <div
            className={`absolute inset-y-0 h-full rounded-full ${
              loopEnabled ? 'bg-accent/30' : 'bg-gray-400/20'
            }`}
            style={{ left: `${segStartPct}%`, width: `${segWidthPct}%` }}
          />
        )}
        {/* 再生進捗 */}
        <div
          className="absolute inset-y-0 left-0 h-full bg-accent rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 tabular-nums min-w-[2.5rem] flex-shrink-0">
        {formatDuration(dur)}
      </span>
    </div>
  );
}
