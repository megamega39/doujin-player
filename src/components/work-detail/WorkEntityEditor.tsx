import { useState, useEffect, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { useTranslation } from '../../i18n';

export interface EntityWithCount {
  id: string;
  name: string;
  work_count: number;
}

interface WorkEntityEditorProps<T extends EntityWithCount> {
  workId: string;
  title: string;
  placeholder: string;
  removeTitle: string;
  getWorkItems: (workId: string) => Promise<T[]>;
  getAllItems: () => Promise<T[]>;
  addItem: (workId: string, name: string) => Promise<unknown>;
  removeItem: (workId: string, itemId: string) => Promise<unknown>;
}

export function WorkEntityEditor<T extends EntityWithCount>({
  workId,
  title,
  placeholder,
  removeTitle,
  getWorkItems,
  getAllItems,
  addItem,
  removeItem,
}: WorkEntityEditorProps<T>) {
  const { t } = useTranslation();
  const [items, setItems] = useState<T[]>([]);
  const [allItems, setAllItems] = useState<T[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const load = useCallback(async () => {
    const [workItems, all] = await Promise.all([
      getWorkItems(workId),
      getAllItems(),
    ]);
    setItems(workItems);
    setAllItems(all);
  }, [workId, getWorkItems, getAllItems]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const v = inputValue.trim().toLowerCase();
    const available = allItems.filter((t) => !items.some((w) => w.id === t.id));
    if (!v) {
      // 入力が空の場合は使用頻度順で候補表示
      const sorted = [...available].sort((a, b) => b.work_count - a.work_count);
      setSuggestions(sorted.slice(0, 8));
    } else {
      const filtered = available.filter((t) => t.name.toLowerCase().includes(v));
      setSuggestions(filtered.slice(0, 8));
    }
  }, [inputValue, allItems, items]);

  async function handleAdd() {
    const name = inputValue.trim();
    if (!name) return;
    try {
      await addItem(workId, name);
      setInputValue('');
      setShowSuggestions(false);
      load();
    } catch (e) {
      console.error('Failed to add:', e);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeItem(workId, id);
      load();
    } catch (e) {
      console.error('Failed to remove:', e);
    }
  }

  function handleSelectSuggestion(item: T) {
    addItem(workId, item.name).then(load).catch(console.error);
    setInputValue('');
    setShowSuggestions(false);
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-400">{title}</h4>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent/20 text-accent text-sm"
          >
            {item.name}
            <button
              onClick={() => handleRemove(item.id)}
              className="hover:bg-accent/30 rounded-full p-0.5"
              title={removeTitle}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <div className="relative inline-flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={placeholder}
            className="px-3 py-1 bg-dark-card border border-dark-border rounded-full text-sm w-32 focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
          {inputValue.trim() && (
            <button
              onClick={handleAdd}
              className="absolute right-2 text-gray-400 hover:text-accent"
              title={t('workDetail.add')}
            >
              <Plus size={16} />
            </button>
          )}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 py-1 bg-dark-card border border-dark-border rounded-lg shadow-xl z-20 min-w-[180px] max-h-[200px] overflow-y-auto">
              {!inputValue.trim() && (
                <div className="px-3 py-1 text-xs text-gray-400 border-b border-dark-border mb-1">
                  {t('workDetail.frequentlyUsed')}
                </div>
              )}
              {suggestions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectSuggestion(item)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-dark-hover flex items-center justify-between gap-2"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    {item.work_count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
