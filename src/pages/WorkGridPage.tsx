import { WorkGrid, type WorkGridProps } from '../components/library/WorkGrid';
import { useTranslation } from '../i18n';

interface WorkGridPageProps extends Omit<WorkGridProps, 'filterFavorite' | 'filterRecent'> {
  titleKey: string;
  filterFavorite?: boolean;
  filterRecent?: boolean;
}

export function WorkGridPage({
  titleKey,
  filterFavorite,
  filterRecent,
  ...workGridProps
}: WorkGridPageProps) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-2xl font-semibold px-6 pt-6">{t(titleKey)}</h2>
      <WorkGrid filterFavorite={filterFavorite} filterRecent={filterRecent} {...workGridProps} />
    </div>
  );
}
