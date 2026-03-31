import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePlayerStore } from '../stores/playerStore';
import { useShortcutStore } from '../stores/shortcutStore';
import { useEffectiveTrackIndex } from './useEffectiveTrackIndex';
import { eventToShortcutKey } from '../utils/shortcutKey';
import { isVideoTrack } from '../utils/media';
import { api } from '../api';

function isInputFocused(): boolean {
  const target = document.activeElement;
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useShortcuts() {
  const volumeBeforeMuteRef = useRef(1);
  const { shortcuts } = useShortcutStore();
  const {
    currentTrack,
    isPlaying,
    trackList,
    setPlaying,
    setPlayableItem,
    setCurrentTime,
    setVolume,
    volume,
    loopSegment,
    loopEnabled,
    duration,
    setLoopSegment,
    setLoopEnabled,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      trackList: s.trackList,
      volume: s.volume,
      setPlaying: s.setPlaying,
      setPlayableItem: s.setPlayableItem,
      setCurrentTime: s.setCurrentTime,
      setVolume: s.setVolume,
      loopSegment: s.loopSegment,
      loopEnabled: s.loopEnabled,
      duration: s.duration,
      setLoopSegment: s.setLoopSegment,
      setLoopEnabled: s.setLoopEnabled,
    }))
  );

  const effectiveIndex = useEffectiveTrackIndex();
  const isVideo = currentTrack ? isVideoTrack(currentTrack.file_path) : false;

  useEffect(() => {
    const getMedia = () => {
      const el = isVideo
        ? document.querySelector('video')
        : document.querySelector('audio');
      return el as HTMLMediaElement | null;
    };

    function handleKeyDown(e: KeyboardEvent) {
      if (isInputFocused()) return;
      const keys = eventToShortcutKey(e);
      if (!keys) return;

      const matchId = Object.entries(shortcuts).find(([, v]) => v === keys)?.[0];
      if (!matchId) return;

      e.preventDefault();

      switch (matchId) {
        case 'play_pause': {
          if (!currentTrack) return;
          const media = getMedia();
          if (media) {
            if (isPlaying) media.pause();
            else media.play();
            setPlaying(!isPlaying);
          }
          break;
        }
        case 'seek_forward': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const d = media.duration;
          const newTime = Math.min(t + 10, isFinite(d) ? d : t + 10);
          media.currentTime = newTime;
          setCurrentTime(newTime);
          api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
          break;
        }
        case 'seek_backward': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const newTime = Math.max(0, t - 10);
          media.currentTime = newTime;
          setCurrentTime(newTime);
          api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
          break;
        }
        case 'seek_forward_more': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const d = media.duration;
          const newTime = Math.min(t + 30, isFinite(d) ? d : t + 30);
          media.currentTime = newTime;
          setCurrentTime(newTime);
          api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
          break;
        }
        case 'seek_backward_more': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const newTime = Math.max(0, t - 30);
          media.currentTime = newTime;
          setCurrentTime(newTime);
          api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
          break;
        }
        case 'prev_track': {
          if (!trackList.length || !currentTrack) return;
          const idx = effectiveIndex;
          const prevIdx = idx >= 0 ? idx - 1 : -1;
          const prevItem =
            prevIdx >= 0 ? trackList[prevIdx] : trackList[trackList.length - 1];
          if (prevItem) {
            setPlayableItem(prevItem, prevIdx >= 0 ? prevIdx : trackList.length - 1);
            setPlaying(true);
          }
          break;
        }
        case 'next_track': {
          if (!trackList.length || !currentTrack) return;
          const idx = effectiveIndex;
          const nextIdx = idx >= 0 ? idx + 1 : 0;
          const nextItem =
            nextIdx < trackList.length ? trackList[nextIdx] : trackList[0];
          if (nextItem) {
            setPlayableItem(nextItem, nextIdx < trackList.length ? nextIdx : 0);
            setPlaying(true);
          } else {
            setPlaying(false);
          }
          break;
        }
        case 'mute': {
          if (volume > 0) {
            volumeBeforeMuteRef.current = volume;
            setVolume(0);
          } else {
            setVolume(volumeBeforeMuteRef.current);
          }
          break;
        }
        case 'volume_up': {
          setVolume(Math.min(1, volume + 0.1));
          break;
        }
        case 'volume_down': {
          setVolume(Math.max(0, volume - 0.1));
          break;
        }
        case 'seek_forward_small': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const d = media.duration;
          const newTime = Math.min(t + 5, isFinite(d) ? d : t + 5);
          media.currentTime = newTime;
          setCurrentTime(newTime);
          api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
          break;
        }
        case 'seek_backward_small': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const newTime = Math.max(0, t - 5);
          media.currentTime = newTime;
          setCurrentTime(newTime);
          api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
          break;
        }
        case 'set_loop_a': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          const d = media.duration;
          setLoopSegment({
            start: t,
            end: loopSegment ? loopSegment.end : Math.min(t + 1, isFinite(d) ? d : t + 1),
          });
          break;
        }
        case 'set_loop_b': {
          if (!currentTrack) return;
          const media = getMedia();
          if (!media) return;
          const t = media.currentTime;
          setLoopSegment({
            start: loopSegment ? loopSegment.start : Math.max(0, t - 1),
            end: t,
          });
          break;
        }
        case 'toggle_loop': {
          if (!loopSegment || loopSegment.start >= loopSegment.end) return;
          setLoopEnabled(!loopEnabled);
          break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    shortcuts,
    currentTrack,
    effectiveIndex,
    isPlaying,
    isVideo,
    trackList,
    volume,
    loopSegment,
    loopEnabled,
    duration,
    setPlaying,
    setPlayableItem,
    setCurrentTime,
    setVolume,
    setLoopSegment,
    setLoopEnabled,
  ]);
}
