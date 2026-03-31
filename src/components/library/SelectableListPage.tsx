import { useState, useEffect, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import { WorkGrid } from './WorkGrid';
import { useTranslation } from '../../i18n';

export interface SelectableEntity {
  id: string;
  name: string;
  work_count: number;
}

type WorkGridFilterKey = 'tagId' | 'voiceActorId' | 'circleId';

interface SelectableListPageProps<T extends SelectableEntity> {
  title: string;
  emptyMessage: string;
  selectPrompt: string;
  hintMessage: string;
  loadItems: () => Promise<T[]>;
  filterKey: WorkGridFilterKey;
  icon: LucideIcon;
}

export function SelectableListPage<T extends SelectableEntity>({
  title,
  emptyMessage,
  selectPrompt,
  hintMessage,
  loadItems,
  filterKey,
  icon: Icon,
}: SelectableListPageProps<T>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<T[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadItems();
      setItems(data);
    } catch (e) {
      console.error('Failed to load:', e);
    } finally {
      setLoading(false);
    }
  }, [loadItems]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = items.find((t) => t.id === selectedId);

  return (
    <div>
      <h2 className="text-2xl font-semibold px-6 pt-6">{title}</h2>
      <div className="p-6">
        {loading ? (
          <div className="text-gray-400">{t('loading')}</div>
        ) : items.length === 0 ? (
          <div className="text-gray-400">{emptyMessage}</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedId(null)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  !selectedId
                    ? 'bg-accent/20 text-accent'
                    : 'bg-dark-card border border-dark-border hover:bg-dark-hover'
                }`}
              >
                {selectPrompt}
              </button>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    selectedId === item.id
                      ? 'bg-accent/20 text-accent'
                      : 'bg-dark-card border border-dark-border hover:bg-dark-hover'
                  }`}
                >
                  <Icon size={14} />
                  {item.name}
                  <span className="text-gray-400 text-xs">({item.work_count})</span>
                </button>
              ))}
            </div>
            {selectedId ? (
              <>
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-300">
                    「{selected?.name}」の作品
                  </h3>
                </div>
                <WorkGrid
                  {...({ [filterKey]: selectedId } as { tagId?: string; voiceActorId?: string; circleId?: string })}
                  key={selectedId}
                />
              </>
            ) : (
              <div className="text-gray-400 py-8 text-center">
                {hintMessage}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
