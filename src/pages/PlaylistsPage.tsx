import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ListMusic, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from '../i18n';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api, type Playlist } from '../api';

interface SortablePlaylistRowProps {
  pl: Playlist;
  idx: number;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function SortablePlaylistRow({
  pl,
  idx,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
}: SortablePlaylistRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pl.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border transition-colors group ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-300 p-1 -m-1 touch-none"
        title={t('playlists.dragToReorder')}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={18} />
      </span>
      <div className="flex flex-col flex-shrink-0 gap-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveUp();
          }}
          disabled={idx === 0}
          className="p-0.5 rounded text-gray-400 hover:text-gray-300 hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('playlists.moveUp')}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMoveDown();
          }}
          disabled={isLast}
          className="p-0.5 rounded text-gray-400 hover:text-gray-300 hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed"
          title={t('playlists.moveDown')}
        >
          <ChevronDown size={14} />
        </button>
      </div>
      <Link
        to={`/playlists/${pl.id}`}
        className="flex flex-1 items-center gap-4 min-w-0"
      >
        <ListMusic size={24} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{pl.name}</div>
          <div className="text-sm text-gray-400">
            {t('playlists.tracks', { count: pl.track_count })}
          </div>
        </div>
      </Link>
      <button
        onClick={onDelete}
        className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        title={t('workDetail.delete')}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}

export function PlaylistsPage() {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getPlaylists();
      setPlaylists(list);
    } catch (e) {
      console.error('Failed to load playlists:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.createPlaylist(name);
      setNewName('');
      load();
    } catch (e) {
      console.error('Failed to create playlist:', e);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await api.deletePlaylist(id);
      load();
    } catch (e) {
      console.error('Failed to delete playlist:', e);
    }
  }

  const handleReorder = useCallback(
    async (newOrder: Playlist[]) => {
      setPlaylists(newOrder);
      try {
        await api.reorderPlaylists(newOrder.map((p) => p.id));
      } catch (err) {
        console.error('Failed to reorder playlists:', err);
        load();
      }
    },
    [load]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = playlists.findIndex((p) => p.id === active.id);
    const newIndex = playlists.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const newOrder = arrayMove(playlists, oldIndex, newIndex);
    handleReorder(newOrder);
  }

  function handleMoveUp(idx: number) {
    if (idx <= 0) return;
    const newOrder = [...playlists];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx]!, newOrder[idx - 1]!];
    handleReorder(newOrder);
  }

  function handleMoveDown(idx: number) {
    if (idx >= playlists.length - 1) return;
    const newOrder = [...playlists];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1]!, newOrder[idx]!];
    handleReorder(newOrder);
  }

  return (
    <div className="px-6 py-6">
      <h2 className="text-2xl font-semibold mb-6">{t('playlists.title')}</h2>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder={t('playlists.newName')}
          className="px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 w-56"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newName.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium text-white transition-colors"
        >
          <Plus size={18} />
          {t('playlists.create')}
        </button>
      </div>

      {loading ? (
        <div className="text-gray-400">{t('loading')}</div>
      ) : playlists.length === 0 ? (
        <div className="text-gray-400 py-8">
          {t('playlists.empty')}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={playlists.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {playlists.map((pl, idx) => (
                <SortablePlaylistRow
                  key={pl.id}
                  pl={pl}
                  idx={idx}
                  isLast={idx === playlists.length - 1}
                  onMoveUp={() => handleMoveUp(idx)}
                  onMoveDown={() => handleMoveDown(idx)}
                  onDelete={(e) => handleDelete(pl.id, e)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
