import { CircleDot } from 'lucide-react';
import { api } from '../api';
import { SelectableListPage } from '../components/library/SelectableListPage';

export function CirclesPage() {
  return (
    <SelectableListPage
      title="サークル"
      emptyMessage="サークルがまだありません。作品詳細画面でサークルを追加するとここに表示されます。"
      selectPrompt="サークルを選択"
      hintMessage="サークルをクリックして、そのサークルの作品を表示できます。"
      loadItems={api.getCircles}
      filterKey="circleId"
      icon={CircleDot}
    />
  );
}
