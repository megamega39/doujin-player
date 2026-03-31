import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5] as const;

interface SpeedControlProps {
  playbackRate: number;
  onRateChange: (rate: number) => void;
}

export function SpeedControl({ playbackRate, onRateChange }: SpeedControlProps) {
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
        className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-dark-hover/50 hover:bg-dark-hover text-xs font-medium text-gray-300 tabular-nums transition-colors"
        title="再生速度"
      >
        {playbackRate}x
        <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1 py-1 bg-dark-card border border-dark-border rounded-lg shadow-xl z-20">
          {SPEED_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => {
                onRateChange(r);
                setOpen(false);
              }}
              className={`w-full px-4 py-1.5 text-left text-xs tabular-nums transition-colors ${
                playbackRate === r
                  ? 'bg-accent/20 text-accent'
                  : 'text-gray-400 hover:bg-dark-hover hover:text-gray-200'
              }`}
            >
              {r}x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
