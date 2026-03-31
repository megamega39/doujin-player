import { useState, useRef, useEffect } from 'react';
import { Timer, ChevronDown } from 'lucide-react';
import { formatDuration } from '../../../utils/format';

const SLEEP_OPTIONS = [
  { label: '5分', sec: 5 * 60 },
  { label: '10分', sec: 10 * 60 },
  { label: '15分', sec: 15 * 60 },
  { label: '30分', sec: 30 * 60 },
  { label: '1時間', sec: 60 * 60 },
] as const;

interface SleepTimerProps {
  remaining: number | null;
  onSet: (seconds: number | null) => void;
}

export function SleepTimer({ remaining, onSet }: SleepTimerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          remaining != null && remaining > 0
            ? 'bg-accent/20 text-accent'
            : 'bg-dark-hover/50 hover:bg-dark-hover text-gray-300'
        }`}
        title="スリープタイマー（○分後に停止）"
      >
        <Timer size={14} />
        {remaining != null && remaining > 0 ? (
          <span className="tabular-nums">あと {formatDuration(remaining)}</span>
        ) : (
          <span>スリープ</span>
        )}
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 py-1 bg-dark-card border border-dark-border rounded-lg shadow-xl z-20 min-w-[6rem]">
          {SLEEP_OPTIONS.map(({ label, sec }) => (
            <button
              key={sec}
              onClick={() => {
                onSet(sec);
                setOpen(false);
              }}
              className="w-full px-4 py-1.5 text-left text-xs text-gray-400 hover:bg-dark-hover hover:text-gray-200 transition-colors"
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => {
              onSet(null);
              setOpen(false);
            }}
            className={`w-full px-4 py-1.5 text-left text-xs transition-colors ${
              remaining == null
                ? 'bg-accent/20 text-accent'
                : 'text-gray-400 hover:bg-dark-hover hover:text-gray-200'
            }`}
          >
            オフ
          </button>
        </div>
      )}
    </div>
  );
}
