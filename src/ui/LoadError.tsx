import { useT } from '../features/i18n/translate';
import './loading.css';

interface LoadErrorProps { message: string; onRetry: () => void; onExit: () => void; }

export function LoadError({ message, onRetry, onExit }: LoadErrorProps) {
  const t = useT();
  return (
    <section className="load-error" role="alert" aria-live="assertive">
      <span className="load-error__mark" aria-hidden="true">!</span>
      <h2>{t('app.sceneNeedsMoment')}</h2>
      <p>{message}</p>
      <div className="load-error__actions">
        <button type="button" className="button button-primary" onClick={onRetry}>{t('app.reloadScene')}</button>
        <button type="button" className="button button-secondary" onClick={onExit}>{t('app.saveReturn')}</button>
      </div>
    </section>
  );
}

export type { LoadErrorProps };
