import { Play, Pause } from 'lucide-react';

export interface PlayableItemRowProps {
  isCurrent: boolean;
  isPlaying: boolean;
  onClick: () => void;
  leadingSlot: React.ReactNode;
  mediaIconSlot?: React.ReactNode;
  middleContent: React.ReactNode;
  trailingSlot?: React.ReactNode;
  actionsSlot?: React.ReactNode;
  /** 非選択時にも Play アイコンを表示する（LoopSegmentList 用） */
  showPlayWhenNotCurrent?: boolean;
}

/**
 * トラック・区間など再生可能な行の共通UI。
 * TrackList, LoopSegmentList で使用。
 */
export function PlayableItemRow({
  isCurrent,
  isPlaying,
  onClick,
  leadingSlot,
  mediaIconSlot,
  middleContent,
  trailingSlot,
  actionsSlot,
  showPlayWhenNotCurrent = false,
}: PlayableItemRowProps) {
  const playPauseIcon = isCurrent ? (
    isPlaying ? (
      <Pause size={16} fill="currentColor" />
    ) : (
      <Play size={16} fill="currentColor" />
    )
  ) : showPlayWhenNotCurrent ? (
    <Play size={16} />
  ) : null;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group ${
        isCurrent && isPlaying
          ? 'bg-accent/20 border border-accent/50'
          : isCurrent
            ? 'bg-accent/10 border border-accent/30'
            : 'bg-dark-card hover:bg-dark-hover border border-transparent'
      }`}
    >
      <span className="flex items-center gap-0.5 flex-shrink-0">
        <span className="w-6 flex items-center justify-center text-accent">
          {playPauseIcon}
        </span>
        {leadingSlot}
      </span>
      {mediaIconSlot != null && (
        <span className="flex-shrink-0 text-gray-400">{mediaIconSlot}</span>
      )}
      <span className="flex-1 min-w-0 overflow-hidden">{middleContent}</span>
      {trailingSlot != null && (
        <span className="flex-shrink-0 text-gray-400 text-sm font-mono tabular-nums min-w-[3.5rem] text-right">
          {trailingSlot}
        </span>
      )}
      {actionsSlot != null && (
        <div onClick={(e) => e.stopPropagation()}>{actionsSlot}</div>
      )}
    </div>
  );
}
