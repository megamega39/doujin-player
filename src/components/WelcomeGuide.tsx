import { useState } from 'react';
import { FolderOpen, Play, Repeat, Heart, Keyboard, X, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTranslation } from '../i18n';

interface WelcomeGuideProps {
  onClose: () => void;
}

interface Step {
  iconSlot: React.ReactNode;
  titleKey: string;
  descKey: string;
}

const STEPS: Step[] = [
  {
    iconSlot: <FolderOpen size={40} className="text-accent" />,
    titleKey: 'guide.step1Title',
    descKey: 'guide.step1Desc',
  },
  {
    iconSlot: <Play size={40} className="text-accent" />,
    titleKey: 'guide.step2Title',
    descKey: 'guide.step2Desc',
  },
  {
    iconSlot: <Repeat size={40} className="text-accent" />,
    titleKey: 'guide.step3Title',
    descKey: 'guide.step3Desc',
  },
  {
    iconSlot: <Heart size={40} className="text-accent" />,
    titleKey: 'guide.step4Title',
    descKey: 'guide.step4Desc',
  },
  {
    iconSlot: <Keyboard size={40} className="text-accent" />,
    titleKey: 'guide.step5Title',
    descKey: 'guide.step5Desc',
  },
];

export function WelcomeGuide({ onClose }: WelcomeGuideProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70">
      <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl w-[28rem] max-w-[90vw] overflow-hidden">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-semibold">{t('guide.title')}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="px-8 py-8 flex flex-col items-center text-center min-h-[220px]">
          <div className="mb-5">{current?.iconSlot}</div>
          <h3 className="text-base font-medium mb-2">{t(current?.titleKey ?? '')}</h3>
          <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
            {t(current?.descKey ?? '')}
          </p>
        </div>

        {/* ステップインジケーター */}
        <div className="flex justify-center gap-1.5 pb-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-accent' : 'bg-dark-border hover:bg-gray-400'
              }`}
            />
          ))}
        </div>

        {/* ナビゲーション */}
        <div className="flex items-center justify-between px-5 pb-5">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-dark-hover disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            {t('guide.prev')}
          </button>
          {isLast ? (
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm bg-accent hover:bg-accent/80 text-white font-medium"
            >
              {t('guide.start')}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-accent hover:bg-accent/80 text-white font-medium"
            >
              {t('guide.next')}
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
