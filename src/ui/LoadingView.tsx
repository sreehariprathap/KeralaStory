import { useT } from '../features/i18n/translate';
import './loading.css';

interface LoadingViewProps { label?: string; loaded?: number; total?: number; }

export function LoadingView({ label, loaded, total }: LoadingViewProps) {
  const t = useT();
  const hasProgress = Number.isFinite(loaded) && Number.isFinite(total) && (total ?? 0) > 0 && (loaded ?? -1) >= 0 && (loaded ?? 0) <= (total ?? 0);
  const value = hasProgress ? Math.round(((loaded ?? 0) / (total ?? 1)) * 100) : null;
  return (
    <section className="loading-view" role="status" aria-live="polite" aria-busy="true">
      <span className="loading-view__spinner" aria-hidden="true" />
      <h2>{label ?? t('app.somewhereClouds')}</h2>
      <p>{hasProgress ? `${loaded} / ${total}` : t('app.preparingTrail')}</p>
      {hasProgress && <div className="loading-view__progress" role="progressbar" aria-label={label ?? t('app.preparingTrail')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0}><span style={{ width: `${value}%` }} /></div>}
    </section>
  );
}

export type { LoadingViewProps };
