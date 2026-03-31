import { Mic } from 'lucide-react';
import { api } from '../api';
import { SelectableListPage } from '../components/library/SelectableListPage';

export function VoiceActorsPage() {
  return (
    <SelectableListPage
      title="声優"
      emptyMessage="声優がまだありません。作品詳細画面で声優を追加するとここに表示されます。"
      selectPrompt="声優を選択"
      hintMessage="声優をクリックして、その声優の作品を表示できます。"
      loadItems={api.getVoiceActors}
      filterKey="voiceActorId"
      icon={Mic}
    />
  );
}
