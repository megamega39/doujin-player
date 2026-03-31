import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../stores/playerStore';

/**
 * currentTrackIndex が無効な場合に trackList から currentTrack で検索して実際のインデックスを返す。
 * MiniPlayer, useShortcuts などで重複していたロジックを共通化。
 */
export function useEffectiveTrackIndex(): number {
  const { currentTrackIndex, trackList, currentTrack } = usePlayerStore(
    useShallow((s) => ({
      currentTrackIndex: s.currentTrackIndex,
      trackList: s.trackList,
      currentTrack: s.currentTrack,
    }))
  );

  return useMemo(() => {
    if (currentTrackIndex >= 0 && currentTrackIndex < trackList.length) {
      return currentTrackIndex;
    }
    if (currentTrack && trackList.length > 0) {
      const found = trackList.findIndex((it) => it.track.id === currentTrack.id);
      return found >= 0 ? found : -1;
    }
    return -1;
  }, [currentTrackIndex, trackList, currentTrack]);
}
