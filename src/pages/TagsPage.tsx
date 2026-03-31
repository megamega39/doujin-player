import { Tag } from 'lucide-react';
import { api } from '../api';
import { SelectableListPage } from '../components/library/SelectableListPage';

export function TagsPage() {
  return (
    <SelectableListPage
      title="タグ"
      emptyMessage="タグがまだありません。作品詳細画面でタグを追加するとここに表示されます。"
      selectPrompt="タグを選択"
      hintMessage="タグをクリックして、そのタグが付いた作品を表示できます。"
      loadItems={api.getTags}
      filterKey="tagId"
      icon={Tag}
    />
  );
}
