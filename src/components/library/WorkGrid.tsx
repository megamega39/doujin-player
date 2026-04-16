import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { openPath } from '@tauri-apps/plugin-opener';
import { CheckSquare, Square, X, Plus } from 'lucide-react';
import { api, type Work } from '../../api';
import { useTranslation } from '../../i18n';
import { WorkCard } from './WorkCard';
import { WorkCardContextMenu } from './WorkCardContextMenu';

const GAP = 16;
const ROW_HEIGHT_ESTIMATE = 320; // サムネ + タイトル・トラック数表示分を確保
const OVERSCAN = 3;

export type SortBy = 'created_at' | 'last_played_at' | 'title' | 'track_count';
export type SortOrder = 'asc' | 'desc';

// ソート設定の永続化
const SORT_STORAGE_KEY = 'work-grid-sort';
function loadSortPreference(): { sortBy: SortBy; sortOrder: SortOrder } {
  try {
    const raw = localStorage.getItem(SORT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { sortBy: parsed.sortBy ?? 'title', sortOrder: parsed.sortOrder ?? 'asc' };
    }
  } catch { /* ignore */ }
  return { sortBy: 'title', sortOrder: 'asc' };
}
function saveSortPreference(sortBy: SortBy, sortOrder: SortOrder) {
  localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ sortBy, sortOrder }));
}

export interface WorkGridProps {
  filterFavorite?: boolean;
  filterRecent?: boolean;
  tagId?: string;
  voiceActorId?: string;
  circleId?: string;
  showSort?: boolean;
  toolbarExtra?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  refreshTrigger?: number;
}

export function WorkGrid({
  filterFavorite,
  filterRecent,
  tagId,
  voiceActorId,
  circleId,
  showSort = false,
  toolbarExtra,
  toolbarRight,
  refreshTrigger,
}: WorkGridProps) {
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>(() => loadSortPreference().sortBy);
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => loadSortPreference().sortOrder);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    folderPath: string;
  } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagInput, setBulkTagInput] = useState('');
  const [bulkTagType, setBulkTagType] = useState<'tag' | 'voiceActor' | 'circle'>('tag');
  const [bulkSuggestions, setBulkSuggestions] = useState<{ id: string; name: string; work_count: number }[]>([]);
  const [showBulkSuggestions, setShowBulkSuggestions] = useState(false);
  const { t } = useTranslation();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkTagInput('');
  }, []);

  // 一括タグ付けのサジェスト
  useEffect(() => {
    if (!selectMode) return;
    const loadSuggestions = async () => {
      const fetcher = bulkTagType === 'tag' ? api.getTags
        : bulkTagType === 'voiceActor' ? api.getVoiceActors
        : api.getCircles;
      const all = await fetcher();
      const v = bulkTagInput.trim().toLowerCase();
      const filtered = v
        ? all.filter((t) => t.name.toLowerCase().includes(v))
        : [...all].sort((a, b) => b.work_count - a.work_count);
      setBulkSuggestions(filtered.slice(0, 8));
    };
    loadSuggestions().catch(console.error);
  }, [selectMode, bulkTagType, bulkTagInput]);

  const handleBulkAdd = useCallback(async (name: string) => {
    if (!name.trim() || selectedIds.size === 0) return;
    const adder = bulkTagType === 'tag' ? api.addWorkTag
      : bulkTagType === 'voiceActor' ? api.addWorkVoiceActor
      : api.addWorkCircle;
    await Promise.all(
      [...selectedIds].map((workId) => adder(workId, name.trim()))
    );
    setBulkTagInput('');
    setShowBulkSuggestions(false);
  }, [selectedIds, bulkTagType]);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (filterRecent) {
        data = await api.getRecentWorks();
      } else if (tagId || voiceActorId || circleId) {
        data = await api.getWorksFiltered({
          tagId: tagId ?? null,
          voiceActorId: voiceActorId ?? null,
          circleId: circleId ?? null,
        });
      } else {
        data = await api.getWorks();
      }
      setWorks(data);
    } catch (e) {
      console.error('Failed to load works:', e);
    } finally {
      setLoading(false);
    }
  }, [filterRecent, tagId, voiceActorId, circleId]);

  useEffect(() => {
    loadWorks();
  }, [loadWorks, refreshTrigger]);

  // 横断検索（デバウンス付き）+ クリア時リセット
  const searchVersionRef = useRef(0);
  useEffect(() => {
    const version = ++searchVersionRef.current;
    if (!searchQuery.trim()) {
      loadWorks();
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchWorks(searchQuery);
        // バージョンが古い結果なら無視（クリアとのレース回避）
        if (searchVersionRef.current === version) {
          setWorks(data);
        }
      } catch (e) {
        console.error('Search failed:', e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, loadWorks]);


  const handleToggleFavorite = useCallback(
    async (id: string) => {
      await api.toggleFavorite(id);
      loadWorks();
    },
    [loadWorks]
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, work: Work) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folderPath: work.folder_path,
    });
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (!contextMenu) return;
    try {
      await openPath(contextMenu.folderPath);
    } catch (err) {
      console.error('Failed to open folder:', err);
    }
  }, [contextMenu]);

  const handleRescan = useCallback(async () => {
    try {
      await api.rescanLibrary();
      loadWorks();
    } catch (err) {
      console.error('Failed to rescan:', err);
    }
  }, [loadWorks]);

  // ソート設定変更時に永続化
  useEffect(() => {
    saveSortPreference(sortBy, sortOrder);
  }, [sortBy, sortOrder]);

  const filtered = useMemo(() => {
    let result = works.filter((w) => {
      // 検索クエリがある場合はバックエンドで検索済みなのでタイトルフィルター不要
      const matchFav = !filterFavorite || w.is_favorite;
      return matchFav;
    });
    if (!filterRecent) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'title') {
          cmp = (a.title || '').localeCompare(b.title || '', 'ja');
        } else if (sortBy === 'created_at') {
          cmp = (a.created_at ?? 0) - (b.created_at ?? 0);
        } else if (sortBy === 'last_played_at') {
          const aVal = a.last_played_at ?? 0;
          const bVal = b.last_played_at ?? 0;
          cmp = aVal - bVal;
        } else if (sortBy === 'track_count') {
          cmp = (a.track_count ?? 0) - (b.track_count ?? 0);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [works, filterFavorite, sortBy, sortOrder]);

  const parentRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);
  const location = useLocation();
  const scrollKey = `scroll-${location.pathname}`;

  // スクロール位置の復元
  useEffect(() => {
    if (loading || filtered.length === 0) return;
    const el = parentRef.current;
    if (!el) return;
    const saved = sessionStorage.getItem(scrollKey);
    if (saved) {
      requestAnimationFrame(() => { el.scrollTop = parseInt(saved, 10); });
    }
  }, [loading, filtered.length, scrollKey]);

  // スクロール位置の保存
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const handleScroll = () => {
      sessionStorage.setItem(scrollKey, String(el.scrollTop));
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollKey]);

  useEffect(() => {
    if (loading || filtered.length === 0) return;
    const el = parentRef.current;
    if (!el) return;
    const updateColumns = () => {
      const w = el.offsetWidth;
      if (w >= 1280) setColumnCount(6);
      else if (w >= 1024) setColumnCount(5);
      else if (w >= 768) setColumnCount(4);
      else if (w >= 640) setColumnCount(3);
      else if (w >= 400) setColumnCount(2);
      else setColumnCount(1);
    };
    updateColumns();
    const ro = new ResizeObserver(updateColumns);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, filtered.length]);

  const rowCount = Math.ceil(filtered.length / columnCount);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE + GAP,
    overscan: OVERSCAN,
    enabled: filtered.length > 0,
  });

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6 flex flex-wrap items-center gap-2 sm:gap-4">
        <input
          type="text"
          placeholder={t('library.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-shrink-0 w-full sm:max-w-md px-3 sm:px-4 py-2 bg-dark-card border border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        {toolbarExtra}
        <button
          onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            selectMode ? 'bg-accent text-white' : 'bg-dark-card border border-dark-border hover:bg-dark-hover'
          }`}
          title={t('library.selectMode')}
        >
          {selectMode ? <CheckSquare size={16} /> : <Square size={16} />}
          {selectMode ? `${selectedIds.size}${t('library.selected')}` : t('library.select')}
        </button>
        <div className="flex-1 min-w-0" />
        {showSort && (
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              <option value="title">{t('library.sortByTitle')}</option>
              <option value="created_at">{t('library.sortByAdded')}</option>
              <option value="last_played_at">{t('library.sortByPlayed')}</option>
              <option value="track_count">{t('library.sortByTrackCount')}</option>
            </select>
            <button
              onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
              className="px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm hover:bg-dark-hover transition-colors"
              title={sortOrder === 'asc' ? t('library.sortAscTip') : t('library.sortDescTip')}
            >
              {sortOrder === 'asc' ? t('library.sortAsc') : t('library.sortDesc')}
            </button>
          </div>
        )}
        {toolbarRight}
      </div>

      {/* 一括タグ付けバー */}
      {selectMode && selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-dark-card border border-dark-border rounded-lg flex flex-wrap items-center gap-3">
          <select
            value={bulkTagType}
            onChange={(e) => setBulkTagType(e.target.value as 'tag' | 'voiceActor' | 'circle')}
            className="px-3 py-1.5 bg-dark-hover border border-dark-border rounded-lg text-sm"
          >
            <option value="tag">{t('library.tags')}</option>
            <option value="voiceActor">{t('library.voiceActors')}</option>
            <option value="circle">{t('library.circles')}</option>
          </select>
          <div className="relative">
            <input
              type="text"
              value={bulkTagInput}
              onChange={(e) => { setBulkTagInput(e.target.value); setShowBulkSuggestions(true); }}
              onFocus={() => setShowBulkSuggestions(true)}
              onBlur={() => setTimeout(() => setShowBulkSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleBulkAdd(bulkTagInput); }
                if (e.key === 'Escape') setShowBulkSuggestions(false);
              }}
              placeholder={t('library.bulkTagPlaceholder')}
              className="px-3 py-1.5 bg-dark-hover border border-dark-border rounded-lg text-sm w-40 focus:outline-none focus:ring-1 focus:ring-accent/50"
            />
            {showBulkSuggestions && bulkSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 py-1 bg-dark-card border border-dark-border rounded-lg shadow-xl z-20 min-w-[180px] max-h-[200px] overflow-y-auto">
                {bulkSuggestions.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { handleBulkAdd(item.name); }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-dark-hover flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-gray-400 text-xs flex-shrink-0">{item.work_count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => handleBulkAdd(bulkTagInput)}
            disabled={!bulkTagInput.trim()}
            className="px-3 py-1.5 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm text-white font-medium flex items-center gap-1"
          >
            <Plus size={14} />
            {t('library.bulkAdd')}
          </button>
          <button
            onClick={exitSelectMode}
            className="ml-auto p-1.5 rounded-lg hover:bg-dark-hover text-gray-400"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-gray-400">
          {tagId || voiceActorId || circleId
            ? t('library.noWorks')
            : filterRecent
              ? t('library.noRecent')
              : filterFavorite
                ? t('library.noFavorites')
                : t('library.noWorksHint')}
        </div>
      ) : (
        <div
          ref={parentRef}
          className="overflow-auto mt-4"
          style={{ height: 'calc(100vh - 12rem)' }}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const start = virtualRow.index * columnCount;
              const rowWorks = filtered.slice(start, start + columnCount);
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size - GAP,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                    gap: GAP,
                  }}
                >
                  {rowWorks.map((work, i) => (
                    <WorkCard
                      key={work.id}
                      work={work}
                      onToggleFavorite={handleToggleFavorite}
                      onContextMenu={selectMode ? undefined : handleContextMenu}
                      priority={virtualRow.index * columnCount + i < 12}
                      selectMode={selectMode}
                      selected={selectedIds.has(work.id)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {contextMenu && (
        <WorkCardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onOpenFolder={handleOpenFolder}
          onRescan={handleRescan}
        />
      )}
    </div>
  );
}
