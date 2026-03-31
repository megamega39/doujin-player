import { useRef, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { convertFileSrc } from '@tauri-apps/api/core';
import { usePlayerStore } from '../stores/playerStore';
import { usePlaybackSettingsStore } from '../stores/playbackSettingsStore';
import { useEffectiveTrackIndex } from './useEffectiveTrackIndex';
import { isVideoTrack } from '../utils/media';
import { api } from '../api';

export function useMediaPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isPlayingRef = useRef(false);
  const wrapToFirstRef = useRef(false);
  const startupHandledRef = useRef(false);
  const [displayTime, setDisplayTime] = useState(0);
  const [displayDuration, setDisplayDuration] = useState(0);

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    loopSegment,
    loopEnabled,
    setLoopSegment,
    setLoopEnabled,
    trackLoopEnabled,
    playlistLoopEnabled,
    trackList,
    currentSourcePlaylistId,
    setPlaying,
    setPlayableItem,
    setTrackLoopEnabled,
    setPlaylistLoopEnabled,
    setCurrentTime,
    setDuration,
    setVolume,
    setPlaybackRate,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      currentTime: s.currentTime,
      duration: s.duration,
      volume: s.volume,
      playbackRate: s.playbackRate,
      loopSegment: s.loopSegment,
      loopEnabled: s.loopEnabled,
      setLoopSegment: s.setLoopSegment,
      setLoopEnabled: s.setLoopEnabled,
      trackLoopEnabled: s.trackLoopEnabled,
      playlistLoopEnabled: s.playlistLoopEnabled,
      trackList: s.trackList,
      currentSourcePlaylistId: s.currentSourcePlaylistId,
      setPlaying: s.setPlaying,
      setPlayableItem: s.setPlayableItem,
      setTrackLoopEnabled: s.setTrackLoopEnabled,
      setPlaylistLoopEnabled: s.setPlaylistLoopEnabled,
      setCurrentTime: s.setCurrentTime,
      setDuration: s.setDuration,
      setVolume: s.setVolume,
      setPlaybackRate: s.setPlaybackRate,
    }))
  );

  const effectiveIndex = useEffectiveTrackIndex();
  const isVideo = currentTrack ? isVideoTrack(currentTrack.file_path) : false;
  const getMedia = () => (isVideo ? videoRef.current : audioRef.current) as HTMLMediaElement | null;

  // 動画トラックに切り替えた時に動画ビューを展開（フラグのみ返す）
  isPlayingRef.current = isPlaying;

  // 起動時: 自動再生設定に応じて isPlaying を制御
  useEffect(() => {
    if (startupHandledRef.current) return;
    startupHandledRef.current = true;
    const autoPlay = usePlaybackSettingsStore.getState().autoPlayOnStart;
    if (!autoPlay && isPlaying) {
      setPlaying(false);
    }
  }, []);

  // 音量制御
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    if (!media || !currentTrack) return;
    const v = Math.min(1, Math.max(0, volume));
    media.volume = v;
    media.muted = false;
  }, [currentTrack, isVideo, volume]);

  // 再生速度
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (audio) audio.playbackRate = playbackRate;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  // トラック切替時のメディアソース設定
  useEffect(() => {
    const media = isVideo ? videoRef.current : audioRef.current;
    const other = isVideo ? audioRef.current : videoRef.current;
    if (!media || !currentTrack) return;
    const src = convertFileSrc(currentTrack.file_path);
    const startTime = wrapToFirstRef.current
      ? 0
      : loopSegment && loopEnabled
        ? loopSegment.start
        : currentTime > 0
          ? currentTime
          : (currentTrack.last_position_sec || 0);
    if (wrapToFirstRef.current) wrapToFirstRef.current = false;
    const trackDuration = currentTrack.duration_sec ?? 0;

    if (other) {
      (other as HTMLMediaElement).src = '';
    }
    media.src = src;
    media.currentTime = startTime;
    setDisplayTime(startTime);
    setCurrentTime(startTime);
    setDisplayDuration(trackDuration);
    setDuration(trackDuration);

    const onLoadedMetadata = () => {
      const d = media.duration;
      if (isFinite(d) && d >= 0) {
        setDisplayDuration(d);
        setDuration(d);
      }
    };
    const onCanPlay = () => {
      setDisplayTime(media.currentTime);
      setCurrentTime(media.currentTime);
      if (isPlayingRef.current) media.play();
    };
    media.addEventListener('loadedmetadata', onLoadedMetadata);
    media.addEventListener('canplay', onCanPlay, { once: true });
    return () => {
      media.removeEventListener('loadedmetadata', onLoadedMetadata);
      media.removeEventListener('canplay', onCanPlay);
    };
  }, [currentTrack?.id, isVideo]);

  // 再生・一時停止の同期
  useEffect(() => {
    const media = getMedia();
    if (!media) return;
    if (isPlaying) {
      media.play();
      const sync = () => {
        const t = media.currentTime;
        const d = media.duration;
        setDisplayTime(t);
        setCurrentTime(t);
        if (isFinite(d) && d > 0) {
          setDisplayDuration(d);
          setDuration(d);
        }
      };
      const t1 = setTimeout(sync, 50);
      const t2 = setTimeout(sync, 200);
      const t3 = setTimeout(sync, 500);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      media.pause();
    }
  }, [isPlaying, setCurrentTime, setDuration, isVideo]);

  // タイムアップデート、終了時の処理
  useEffect(() => {
    const media = getMedia();
    if (!media || !currentTrack) return;
    const updateTime = () => {
      const t = media.currentTime;
      setDisplayTime(t);
      setCurrentTime(t);
    };
    const updateDuration = () => {
      const d = media.duration;
      if (isFinite(d) && d >= 0) {
        setDisplayDuration(d);
        setDuration(d);
      }
    };
    const onEnded = () => {
      // 再生回数をインクリメント
      if (currentTrack) {
        api.incrementPlayCount(currentTrack.id).catch(console.error);
      }
      if (loopEnabled && loopSegment) {
        media.currentTime = loopSegment.start;
        media.play();
      } else if (trackLoopEnabled) {
        media.currentTime = 0;
        media.play();
      } else if (playlistLoopEnabled && trackList.length > 0) {
        const idx = effectiveIndex;
        const nextIdx = idx >= 0 && idx < trackList.length - 1 ? idx + 1 : 0;
        const nextItem = trackList[nextIdx];
        if (!nextItem) {
          setPlaying(false);
          return;
        }
        const isWrappingToFirst = nextIdx === 0 && idx === trackList.length - 1;
        if (isWrappingToFirst) wrapToFirstRef.current = true;
        setPlayableItem(nextItem, nextIdx);
        if (isWrappingToFirst) setCurrentTime(0);
        setPlaying(true);
      } else {
        setPlaying(false);
      }
    };
    const onPlaying = () => {
      updateTime();
      updateDuration();
    };
    media.addEventListener('timeupdate', updateTime);
    media.addEventListener('durationchange', updateDuration);
    media.addEventListener('loadedmetadata', updateDuration);
    media.addEventListener('loadeddata', updateDuration);
    media.addEventListener('playing', onPlaying);
    media.addEventListener('ended', onEnded);

    const pollTime = () => {
      const t = media.currentTime;
      if (isFinite(t)) {
        setDisplayTime(t);
        setCurrentTime(t);
      }
      const d = media.duration;
      if (isFinite(d) && d > 0) {
        setDisplayDuration(d);
        setDuration(d);
      }
    };
    const intervalId = setInterval(pollTime, 100);

    return () => {
      clearInterval(intervalId);
      media.removeEventListener('timeupdate', updateTime);
      media.removeEventListener('durationchange', updateDuration);
      media.removeEventListener('loadedmetadata', updateDuration);
      media.removeEventListener('loadeddata', updateDuration);
      media.removeEventListener('playing', onPlaying);
      media.removeEventListener('ended', onEnded);
    };
  }, [currentTrack?.id, effectiveIndex, loopEnabled, loopSegment, trackLoopEnabled, playlistLoopEnabled, trackList, setCurrentTime, setDuration, setPlaying, setPlayableItem, isVideo]);

  // 再生位置を保存
  useEffect(() => {
    if (!currentTrack) return;
    const savePosition = () => {
      const t = getMedia()?.currentTime;
      if (t != null && isFinite(t)) {
        api.savePlaybackPosition(currentTrack.id, t).catch(console.error);
      }
    };
    if (isPlaying) {
      const intervalId = setInterval(savePosition, 5000);
      return () => clearInterval(intervalId);
    } else {
      savePosition();
    }
  }, [currentTrack?.id, isPlaying, isVideo]);

  // 区間終端処理: 区間ループON時は常にA点に戻る
  useEffect(() => {
    const media = getMedia();
    if (!media || !loopSegment || !loopEnabled) return;
    const t = media.currentTime;
    if (t >= loopSegment.start && t < loopSegment.end) return;
    media.currentTime = loopSegment.start;
  }, [displayTime, loopEnabled, loopSegment, isVideo]);

  function seekToTime(newTime: number) {
    const media = getMedia();
    if (!media || !currentTrack) return;
    media.currentTime = newTime;
    setDisplayTime(newTime);
    setCurrentTime(newTime);
    api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
  }

  function seekBy(seconds: number) {
    const media = getMedia();
    if (!media || !currentTrack) return;
    const d = media.duration;
    if (!isFinite(d) || d <= 0) return;
    const curTime = displayTime ?? currentTime;
    const newTime = Math.max(0, Math.min(d, curTime + seconds));
    media.currentTime = newTime;
    setDisplayTime(newTime);
    setCurrentTime(newTime);
    api.savePlaybackPosition(currentTrack.id, newTime).catch(console.error);
  }

  // MediaSession API: メディアキー対応
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    if (currentTrack) {
      ms.metadata = new MediaMetadata({
        title: currentTrack.title,
      });
    }
    ms.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack?.id, currentTrack?.title, isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;

    ms.setActionHandler('play', () => {
      if (currentTrack) setPlaying(true);
    });
    ms.setActionHandler('pause', () => {
      setPlaying(false);
    });
    ms.setActionHandler('previoustrack', () => {
      if (!trackList.length || !currentTrack) return;
      const idx = effectiveIndex;
      const prevIdx = idx > 0 ? idx - 1 : trackList.length - 1;
      const prevItem = trackList[prevIdx];
      if (prevItem) { setPlayableItem(prevItem, prevIdx); setPlaying(true); }
    });
    ms.setActionHandler('nexttrack', () => {
      if (!trackList.length || !currentTrack) return;
      const idx = effectiveIndex;
      const nextIdx = idx < trackList.length - 1 ? idx + 1 : 0;
      const nextItem = trackList[nextIdx];
      if (nextItem) { setPlayableItem(nextItem, nextIdx); setPlaying(true); }
    });
    ms.setActionHandler('seekbackward', () => seekBy(-10));
    ms.setActionHandler('seekforward', () => seekBy(10));

    return () => {
      ms.setActionHandler('play', null);
      ms.setActionHandler('pause', null);
      ms.setActionHandler('previoustrack', null);
      ms.setActionHandler('nexttrack', null);
      ms.setActionHandler('seekbackward', null);
      ms.setActionHandler('seekforward', null);
    };
  }, [currentTrack?.id, effectiveIndex, trackList, setPlaying, setPlayableItem]);

  return {
    audioRef,
    videoRef,
    displayTime,
    displayDuration,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    loopSegment,
    loopEnabled,
    trackLoopEnabled,
    playlistLoopEnabled,
    trackList,
    currentSourcePlaylistId,
    effectiveIndex,
    isVideo,
    setPlaying,
    setPlayableItem,
    setTrackLoopEnabled,
    setPlaylistLoopEnabled,
    setCurrentTime,
    setVolume,
    setPlaybackRate,
    setLoopSegment,
    setLoopEnabled,
    seekToTime,
    seekBy,
    getMedia,
  };
}
