import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n';
import { WorkGrid } from '../components/library/WorkGrid';
import { LibraryFilterBar } from '../components/library/LibraryFilterBar';
import { useLibraryRescanStore } from '../stores/libraryRescanStore';

export function LibraryPage() {
  const { t } = useTranslation();
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [selectedVoiceActorId, setSelectedVoiceActorId] =
    useState<string | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const { inProgress: rescanning, refreshTrigger, startRescan, progress } =
    useLibraryRescanStore();

  const scanLabel = rescanning && progress
    ? `${progress.current}/${progress.total}`
    : rescanning
      ? t('settings.scanning')
      : t('library.update');

  return (
    <div>
      <WorkGrid
        tagId={selectedTagId ?? undefined}
        voiceActorId={selectedVoiceActorId ?? undefined}
        circleId={selectedCircleId ?? undefined}
        showSort
        toolbarExtra={
          <LibraryFilterBar
            inline
            selectedTagId={selectedTagId}
            selectedVoiceActorId={selectedVoiceActorId}
            selectedCircleId={selectedCircleId}
            onTagChange={setSelectedTagId}
            onVoiceActorChange={setSelectedVoiceActorId}
            onCircleChange={setSelectedCircleId}
          />
        }
        toolbarRight={
          <button
            onClick={startRescan}
            disabled={rescanning}
            className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent/80 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
            title={rescanning && progress ? progress.current_title : t('library.rescan')}
          >
            <RefreshCw size={16} className={rescanning ? 'animate-spin' : ''} />
            {scanLabel}
          </button>
        }
        refreshTrigger={refreshTrigger}
      />
    </div>
  );
}
