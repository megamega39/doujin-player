import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track, PlayableItem } from '../api';

export interface PlayerState {
  currentTrack: Track | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  loopSegment: { start: number; end: number } | null;
  loopEnabled: boolean;
  trackLoopEnabled: boolean;
  playlistLoopEnabled: boolean;
  trackList: PlayableItem[];
  currentSourcePlaylistId: string | null;

  setCurrentTrack: (track: Track | null, index?: number) => void;
  setPlayableItem: (item: PlayableItem, index: number) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (dur: number) => void;
  setVolume: (v: number) => void;
  setPlaybackRate: (r: number) => void;
  setLoopSegment: (seg: { start: number; end: number } | null) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setTrackLoopEnabled: (enabled: boolean) => void;
  setPlaylistLoopEnabled: (enabled: boolean) => void;
  setTrackList: (items: PlayableItem[], sourcePlaylistId?: string | null) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      currentTrack: null,
      currentTrackIndex: -1,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      playbackRate: 1,
      loopSegment: null,
      loopEnabled: false,
      trackLoopEnabled: false,
      playlistLoopEnabled: true,
      trackList: [],
      currentSourcePlaylistId: null,

      setCurrentTrack: (t, index) =>
        set((s) => ({
          currentTrack: t,
          currentTrackIndex:
            index !== undefined
              ? index
              : t && s.trackList.length > 0
                ? s.trackList.findIndex(
                    (it) =>
                      it.track.id === t.id &&
                      !it.segment
                  )
                : -1,
          currentTime: t ? (t.last_position_sec ?? 0) : 0,
          loopSegment: null,
          loopEnabled: false,
        })),
      setPlayableItem: (item, index) =>
        set(() => {
          const hasSegment = item.segment && item.segment.start < item.segment!.end;
          return {
            currentTrack: item.track,
            currentTrackIndex: index,
            currentTime: hasSegment ? item.segment!.start : (item.track.last_position_sec ?? 0),
            loopSegment: hasSegment
              ? { start: item.segment!.start, end: item.segment!.end }
              : null,
            loopEnabled: !!hasSegment,
          };
        }),
      setPlaying: (p) => set({ isPlaying: p }),
      setCurrentTime: (t) => set({ currentTime: t }),
      setDuration: (d) => set({ duration: d }),
      setVolume: (v) => set({ volume: v }),
      setPlaybackRate: (r) => set({ playbackRate: r }),
      setLoopSegment: (s) => set({ loopSegment: s }),
      setLoopEnabled: (e) => set({ loopEnabled: e }),
      setTrackLoopEnabled: (e) => set({ trackLoopEnabled: e }),
      setPlaylistLoopEnabled: (e) => set({ playlistLoopEnabled: e }),
      setTrackList: (items, sourcePlaylistId) =>
        set({
          trackList: items,
          currentSourcePlaylistId: sourcePlaylistId ?? null,
        }),
    }),
    {
      name: 'player-state',
      partialize: (s) => ({
        currentTrack: s.currentTrack,
        currentTrackIndex: s.currentTrackIndex,
        currentTime: s.currentTime,
        isPlaying: s.isPlaying,
        trackList: s.trackList,
        volume: s.volume,
        playbackRate: s.playbackRate,
        trackLoopEnabled: s.trackLoopEnabled,
        playlistLoopEnabled: s.playlistLoopEnabled,
        loopSegment: s.loopSegment,
        loopEnabled: s.loopEnabled,
      }),
      migrate: (persisted, _version) => {
        const p = persisted as Record<string, unknown>;
        const list = p?.trackList;
        if (Array.isArray(list) && list.length > 0) {
          const first = list[0];
          if (first && typeof first === 'object' && 'id' in first && !('track' in first)) {
            (p as { trackList: PlayableItem[] }).trackList = (list as { id: string }[]).map(
              (t) => ({ track: t as Track, workId: '' })
            );
          }
        }
        return p as typeof persisted;
      },
    }
  )
);
