import type { ReactNode } from 'react';
import { useT } from '../i18n/translate';

export function ShellSegments({ value }: { value: number }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * 10);
  return <div className="shell-segments" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lit * 10}>
    {Array.from({ length: 10 }, (_, index) => <i key={index} className={index < lit ? 'is-on' : ''}/>)}
  </div>;
}

export function ShellFrame({ title, subtitle, hints, onBack, children }: { title: string; subtitle?: ReactNode; hints?: string; onBack?: () => void; children: ReactNode }) {
  const t = useT();
  return <section className="shell-frame" aria-labelledby="shell-frame-title">
    <header className="shell-frame__head">
      {onBack && <button className="shell-frame__back" onClick={onBack}>← {t('shell.back')}</button>}
      <h1 id="shell-frame-title">{title}</h1>
      {subtitle && <span className="shell-frame__sub">{subtitle}</span>}
    </header>
    <div className="shell-frame__body">{children}</div>
    {hints && <footer className="shell-frame__foot">{hints}</footer>}
  </section>;
}
