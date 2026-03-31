import { Component, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../i18n';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-bg text-gray-200 p-8">
      <h2 className="text-xl font-semibold text-red-400 mb-4">
        {t('error.title')}
      </h2>
      <pre className="text-sm text-gray-400 mb-6 overflow-auto max-w-2xl">
        {error.message}
      </pre>
      <Link
        to="/"
        className="px-4 py-2 bg-accent hover:bg-accent/80 rounded-lg text-white"
      >
        {t('error.backToTop')}
      </Link>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
