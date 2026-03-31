import { invoke } from '@tauri-apps/api/core';

export interface Work {
  id: string;
  title: string;
  folder_path: string;
  thumbnail_path: string | null;
  last_played_at: number | null;
  is_favorite: boolean;
  track_count: number;
  created_at: number;
}

export interface AudioVariant {
  id: string;
  work_id: string;
  label: string;
  folder_path: string;
  se_mode: string | null;
  audio_format: string | null;
  is_default: boolean;
  track_count: number;
}

export interface Track {
  id: string;
  variant_id: string;
  title: string;
  file_path: string;
  track_no: number;
  duration_sec: number | null;
  last_position_sec: number;
  is_favorite: boolean;
}

export interface FavoriteTrackItem {
  track: Track;
  work_id: string;
  work_title: string;
}

export interface LoopSegment {
  id: string;
  track_id: string;
  name: string;
  start_sec: number;
  end_sec: number;
}

/** 再生可能な項目（フルトラック or トラック＋区間） */
export interface PlayableItem {
  track: Track;
  workId: string;
  segment?: {
    id: string;
    name: string;
    start: number;
    end: number;
  };
}

export interface WorkDetail {
  work: Work;
  variants: AudioVariant[];
  tracks: Track[];
}

export interface Tag {
  id: string;
  name: string;
  work_count: number;
}

export interface VoiceActor {
  id: string;
  name: string;
  work_count: number;
}

export interface Circle {
  id: string;
  name: string;
  work_count: number;
}

export interface LibraryRoot {
  id: string;
  path: string;
  created_at: number;
}

export interface Playlist {
  id: string;
  name: string;
  track_count: number;
  sort_order: number;
  created_at: number;
}

export interface PlaylistTrackItem {
  item_id: string;
  track: Track;
  work_id: string;
  segment_start_sec?: number | null;
  segment_end_sec?: number | null;
}

export interface TrackFileStatus {
  track_id: string;
  file_path: string;
  exists: boolean;
}

export const api = {
  getLibraryRoots: () => invoke<LibraryRoot[]>('get_library_roots'),

  scanLibrary: (rootPath: string) => invoke<number>('scan_library', { rootPath }),

  removeLibraryRoot: (rootId: string) =>
    invoke('remove_library_root', { rootId }),

  rescanLibrary: () => invoke<number>('rescan_library'),

  getWorks: () => invoke<Work[]>('get_works'),

  searchWorks: (query: string) => invoke<Work[]>('search_works', { query }),

  getWorksFiltered: (filters: {
    tagId?: string | null;
    voiceActorId?: string | null;
    circleId?: string | null;
  }) =>
    invoke<Work[]>('get_works_filtered', {
      tagId: filters.tagId ?? null,
      voiceActorId: filters.voiceActorId ?? null,
      circleId: filters.circleId ?? null,
    }),

  getRecentWorks: () => invoke<Work[]>('get_recent_works'),

  getWorkDetail: (workId: string) =>
    invoke<WorkDetail | null>('get_work_detail', { workId }),

  getTracks: (variantId: string) =>
    invoke<Track[]>('get_tracks', { variantId }),

  reorderTracks: (variantId: string, trackIds: string[]) =>
    invoke('reorder_tracks', { variantId, trackIds }),

  resetTrackOrder: (variantId: string) =>
    invoke<Track[]>('reset_track_order', { variantId }),

  getMostPlayedTracks: (limit?: number) =>
    invoke<FavoriteTrackItem[]>('get_most_played_tracks', { limit: limit ?? 10 }),

  checkTracksExist: (variantId: string) =>
    invoke<TrackFileStatus[]>('check_tracks_exist', { variantId }),

  getLoopSegments: (trackId: string) =>
    invoke<LoopSegment[]>('get_loop_segments', { trackId }),

  saveLoopSegment: (
    trackId: string,
    name: string,
    startSec: number,
    endSec: number
  ) =>
    invoke('save_loop_segment', {
      trackId,
      name,
      startSec,
      endSec,
    }),

  deleteLoopSegment: (segmentId: string) =>
    invoke('delete_loop_segment', { segmentId }),

  updateLoopSegmentName: (segmentId: string, name: string) =>
    invoke('update_loop_segment_name', { segmentId, name }),

  savePlaybackPosition: (trackId: string, positionSec: number) =>
    invoke('save_playback_position', { trackId, positionSec }),

  incrementPlayCount: (trackId: string) =>
    invoke('increment_play_count', { trackId }),

  toggleFavorite: (workId: string) =>
    invoke<boolean>('toggle_favorite', { workId }),

  toggleTrackFavorite: (trackId: string) =>
    invoke<boolean>('toggle_track_favorite', { trackId }),

  getFavoriteTracks: () =>
    invoke<FavoriteTrackItem[]>('get_favorite_tracks'),

  getThumbnailBase64: (path: string) =>
    invoke<string>('get_thumbnail_base64', { path }),

  getThumbnailPath: (path: string) =>
    invoke<string>('get_thumbnail_path', { path }),

  getWorkImages: (folderPath: string) =>
    invoke<string[]>('get_work_images', { folderPath }),

  setWorkThumbnail: (workId: string, thumbnailPath: string) =>
    invoke('set_work_thumbnail', { workId, thumbnailPath }),

  getTags: () => invoke<Tag[]>('get_tags'),
  getWorksByTag: (tagId: string) => invoke<Work[]>('get_works_by_tag', { tagId }),
  getWorkTags: (workId: string) => invoke<Tag[]>('get_work_tags', { workId }),
  addWorkTag: (workId: string, tagName: string) =>
    invoke('add_work_tag', { workId, tagName }),
  removeWorkTag: (workId: string, tagId: string) =>
    invoke('remove_work_tag', { workId, tagId }),

  getVoiceActors: () => invoke<VoiceActor[]>('get_voice_actors'),
  getWorksByVoiceActor: (voiceActorId: string) =>
    invoke<Work[]>('get_works_by_voice_actor', { voiceActorId }),
  getWorkVoiceActors: (workId: string) =>
    invoke<VoiceActor[]>('get_work_voice_actors', { workId }),
  addWorkVoiceActor: (workId: string, voiceActorName: string) =>
    invoke('add_work_voice_actor', { workId, voiceActorName }),
  removeWorkVoiceActor: (workId: string, voiceActorId: string) =>
    invoke('remove_work_voice_actor', { workId, voiceActorId }),

  getCircles: () => invoke<Circle[]>('get_circles'),
  getWorksByCircle: (circleId: string) =>
    invoke<Work[]>('get_works_by_circle', { circleId }),
  getWorkCircles: (workId: string) =>
    invoke<Circle[]>('get_work_circles', { workId }),
  addWorkCircle: (workId: string, circleName: string) =>
    invoke('add_work_circle', { workId, circleName }),
  removeWorkCircle: (workId: string, circleId: string) =>
    invoke('remove_work_circle', { workId, circleId }),

  // プレイリスト
  getPlaylists: () => invoke<Playlist[]>('get_playlists'),
  createPlaylist: (name: string) =>
    invoke<Playlist>('create_playlist', { name }),
  updatePlaylist: (playlistId: string, name: string) =>
    invoke('update_playlist', { playlistId, name }),
  deletePlaylist: (playlistId: string) =>
    invoke('delete_playlist', { playlistId }),
  reorderPlaylists: (playlistIds: string[]) =>
    invoke('reorder_playlists', { playlist_ids: playlistIds }),
  getPlaylistTracks: (playlistId: string) =>
    invoke<PlaylistTrackItem[]>('get_playlist_tracks', { playlistId }),
  addPlaylistTrack: (
    playlistId: string,
    trackId: string,
    segmentStartSec?: number | null,
    segmentEndSec?: number | null
  ) =>
    invoke('add_playlist_track', {
      playlistId,
      trackId,
      segmentStartSec: segmentStartSec ?? null,
      segmentEndSec: segmentEndSec ?? null,
    }),
  addPlaylistTracks: (playlistId: string, trackIds: string[]) =>
    invoke('add_playlist_tracks', { playlistId, trackIds }),
  removePlaylistItem: (playlistId: string, itemId: string) =>
    invoke('remove_playlist_item', { playlistId, itemId }),

  clearPlaylist: (playlistId: string) =>
    invoke('clear_playlist', { playlistId }),
  reorderPlaylistItems: (playlistId: string, itemIds: string[]) =>
    invoke('reorder_playlist_items', { playlistId, itemIds }),

  setWindowTitle: (title: string) => invoke('set_window_title', { title }),

  getCloseToTray: () => invoke<boolean>('get_close_to_tray'),
  setCloseToTray: (enabled: boolean) => invoke('set_close_to_tray', { enabled }),
};
