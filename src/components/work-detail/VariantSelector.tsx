import type { AudioVariant } from '../../api';

interface VariantSelectorProps {
  variants: AudioVariant[];
  selectedId: string | null;
  onSelect: (variant: AudioVariant) => void;
}

export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: VariantSelectorProps) {
  if (variants.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-400">音声バリエーション</h4>
      <div className="flex flex-wrap gap-2">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedId === v.id
                ? 'bg-accent text-white'
                : 'bg-dark-card border border-dark-border hover:border-accent/50 text-gray-300'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
