import { useState, useEffect, useRef } from 'react';
import { Plus, ListMusic } from 'lucide-react';
import { api, type Playlist } from '../../api';
import { useTranslation } from '../../i18n';

interface AddToPlaylistButtonProps {
  trackId?: string;
  trackIds?: string[];
  /** 区間として追加する場合の開始秒 */
  segmentStartSec?: number;
  /** 区間として追加する場合の終了秒 */
  segmentEndSec?: number;
  multiple?: boolean;
  label?: string;
  onAdded?: () => void;
}

export function AddToPlaylistButton({
  trackId,
  trackIds,
  segmentStartSec,
  segmentEndSec,
  multiple = false,
  label,
  onAdded,
}: AddToPlaylistButtonProps) {
  const { t } = useTranslation();
  const ids = multiple && trackIds ? trackIds : trackId ? [trackId] : [];
  const isSegment =
    segmentStartSec != null &&
    segmentEndSec != null &&
    segmentStartSec < segmentEndSec;
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      api.getPlaylists().then(setPlaylists).catch(console.error);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  async function addTo(playlistId: string) {
    try {
      if (ids.length === 1) {
        await api.addPlaylistTrack(
          playlistId,
          ids[0]!,
          isSegment ? segmentStartSec : null,
          isSegment ? segmentEndSec : null
        );
      } else {
        await api.addPlaylistTracks(playlistId, ids);
      }
      setOpen(false);
      onAdded?.();
    } catch (e) {
      console.error('Failed to add to playlist:', e);
    }
  }

  async function createAndAdd() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const pl = await api.createPlaylist(name);
      if (ids.length === 1) {
        await api.addPlaylistTrack(
          pl.id,
          ids[0]!,
          isSegment ? segmentStartSec : null,
          isSegment ? segmentEndSec : null
        );
      } else {
        await api.addPlaylistTracks(pl.id, ids);
      }
      setNewName('');
      setOpen(false);
      onAdded?.();
    } catch (e) {
      console.error('Failed to create playlist:', e);
    } finally {
      setCreating(false);
    }
  }

  if (ids.length === 0) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/20 transition-colors flex-shrink-0 ${
          label ? '' : 'opacity-0 group-hover:opacity-100'
        }`}
        title={label ?? t('workDetail.addToPlaylist')}
      >
        <Plus size={16} />
        {label && <span className="text-xs">{label}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 py-2 bg-dark-card border border-dark-border rounded-lg shadow-xl z-30 min-w-[180px] max-h-64 overflow-y-auto">
          <div className="px-3 py-2 border-b border-dark-border flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
              placeholder={t('workDetail.newPlaylistName')}
              className="flex-1 px-2 py-1 text-sm bg-dark-bg border border-dark-border rounded focus:outline-none focus:ring-1 focus:ring-accent/50"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                createAndAdd();
              }}
              disabled={creating || !newName.trim()}
              className="px-2 py-1 text-sm bg-accent hover:bg-accent/80 disabled:opacity-50 rounded"
            >
              {t('playlists.create')}
            </button>
          </div>
          {playlists.length > 0 ? (
            <div className="py-1">
              {playlists.map((pl) => (
                <button
                  key={pl.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    addTo(pl.id);
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-dark-hover flex items-center gap-2"
                >
                  <ListMusic size={14} className="text-gray-400" />
                  {pl.name}
                  <span className="text-gray-400 text-xs ml-auto">{pl.track_count}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-gray-400 text-sm">
              {t('workDetail.noPlaylists')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
