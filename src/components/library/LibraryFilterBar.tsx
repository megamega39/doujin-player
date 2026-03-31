import { useState, useEffect, useCallback } from 'react';
import {
  api,
  type Tag as TagType,
  type VoiceActor,
  type Circle,
} from '../../api';
import { useTranslation } from '../../i18n';

interface LibraryFilterBarProps {
  selectedTagId: string | null;
  selectedVoiceActorId: string | null;
  selectedCircleId: string | null;
  onTagChange: (id: string | null) => void;
  onVoiceActorChange: (id: string | null) => void;
  onCircleChange: (id: string | null) => void;
  inline?: boolean;
}

interface FilterDropdownProps {
  label: string;
  items: { id: string; name: string; work_count: number }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function FilterDropdown({
  label,
  items,
  selectedId,
  onSelect,
}: FilterDropdownProps) {
  return (
    <select
      value={selectedId ?? ''}
      onChange={(e) => onSelect(e.target.value || null)}
      className="min-w-[140px] px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 appearance-none cursor-pointer"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%239ca3af' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        paddingRight: '2rem',
      }}
    >
      <option value="">{label}</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} ({item.work_count})
        </option>
      ))}
    </select>
  );
}

export function LibraryFilterBar({
  selectedTagId,
  selectedVoiceActorId,
  selectedCircleId,
  onTagChange,
  onVoiceActorChange,
  onCircleChange,
  inline = false,
}: LibraryFilterBarProps) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<TagType[]>([]);
  const [voiceActors, setVoiceActors] = useState<VoiceActor[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, va, c] = await Promise.all([
        api.getTags(),
        api.getVoiceActors(),
        api.getCircles(),
      ]);
      setTags(t);
      setVoiceActors(va);
      setCircles(c);
    } catch (e) {
      console.error('Failed to load filters:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return null;
  if (tags.length === 0 && voiceActors.length === 0 && circles.length === 0) {
    return null;
  }

  const content = (
    <div className="flex flex-wrap items-center gap-4">
        {tags.length > 0 && (
          <FilterDropdown
            label={t('library.tags')}
            items={tags}
            selectedId={selectedTagId}
            onSelect={onTagChange}
          />
        )}
        {voiceActors.length > 0 && (
          <FilterDropdown
            label={t('library.voiceActors')}
            items={voiceActors}
            selectedId={selectedVoiceActorId}
            onSelect={onVoiceActorChange}
          />
        )}
        {circles.length > 0 && (
          <FilterDropdown
            label={t('library.circles')}
            items={circles}
            selectedId={selectedCircleId}
            onSelect={onCircleChange}
          />
        )}
    </div>
  );

  if (inline) return content;
  return <div className="px-6 pb-4">{content}</div>;
}
