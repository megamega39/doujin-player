import { useCallback, useRef } from 'react';

const MIN_RATE = 0.5;
const MAX_RATE = 3.0;
const STEP = 0.1;

interface SpeedControlProps {
  playbackRate: number;
  onRateChange: (rate: number) => void;
}

function clampRate(value: number): number {
  return Math.round(Math.min(MAX_RATE, Math.max(MIN_RATE, value)) * 10) / 10;
}

export function SpeedControl({ playbackRate, onRateChange }: SpeedControlProps) {
  const sliderRef = useRef<HTMLInputElement>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? STEP : -STEP;
      onRateChange(clampRate(playbackRate + delta));
    },
    [playbackRate, onRateChange],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onRateChange(clampRate(parseFloat(e.target.value)));
    },
    [onRateChange],
  );

  const handleReset = useCallback(() => {
    onRateChange(1);
  }, [onRateChange]);

  return (
    <div
      className="flex items-center gap-2"
      onWheel={handleWheel}
      title="再生速度（ホイールで調整・ダブルクリックでリセット）"
    >
      <span
        className="text-xs font-medium text-gray-300 tabular-nums cursor-pointer select-none min-w-[3.2em] text-center"
        onClick={handleReset}
      >
        {playbackRate.toFixed(1)}x
      </span>
      <input
        ref={sliderRef}
        type="range"
        min={MIN_RATE}
        max={MAX_RATE}
        step={STEP}
        value={playbackRate}
        onChange={handleChange}
        className="w-24 h-1.5 rounded-full cursor-pointer hover:opacity-90 transition-opacity"
        title="再生速度"
      />
    </div>
  );
}
