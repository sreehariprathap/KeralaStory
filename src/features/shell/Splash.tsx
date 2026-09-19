import { useEffect, useState } from 'react';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-700.css';
import { useT } from '../i18n/translate';
import { ShellSegments } from './ShellFrame';

export const SPLASH_MIN_MS = 3500;
export const SPLASH_CAP_MS = 6000;
const CROSSFADE_AT_MS = 1200;
const REDUCED_CUT_AT_MS = 1700;
export const SPLASH_ASSETS = ['/assets/logo-malayalam.png', '/assets/logo-english.png', '/assets/menu-map.webp'] as const;

/** Resolves once the menu's own art and font are usable. Failures resolve too: the menu degrades rather than waits. */
export function preloadSplashAssets(): Promise<void> {
  const images = SPLASH_ASSETS.map(src => new Promise<void>(resolve => { const image = new Image(); image.onload = image.onerror = () => resolve(); image.src = src; }));
  const font = document.fonts?.load('700 20px Oswald').then(() => undefined, () => undefined) ?? Promise.resolve();
  return Promise.all([...images, font]).then(() => undefined);
}

export function Splash({ reducedMotion }: { reducedMotion: boolean }) {
  const t = useT();
  const [english, setEnglish] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const swap = setTimeout(() => setEnglish(true), reducedMotion ? REDUCED_CUT_AT_MS : CROSSFADE_AT_MS);
    const started = performance.now();
    const tick = setInterval(() => setProgress(Math.min(1, (performance.now() - started) / SPLASH_MIN_MS)), 100);
    return () => { clearTimeout(swap); clearInterval(tick); };
  }, [reducedMotion]);
  return <section className="shell-splash" aria-busy="true" aria-label={t('shell.loading')}>
    <div className={`shell-splash__logos ${reducedMotion ? 'is-cut' : ''}`}>
      <img src="/assets/logo-malayalam.png" alt="GTA കോടശ്ശേരി ഡയറീസ് — ഒരു മലയാളി കളിക്കളം" lang="ml" style={{ opacity: english ? 0 : 1 }} onError={event => { event.currentTarget.hidden = true; }}/>
      <img src="/assets/logo-english.png" alt="GTA Kodassery Diaries — A Kerala Saga" lang="en" style={{ opacity: english ? 1 : 0 }} onError={event => { event.currentTarget.hidden = true; }}/>
    </div>
    <ShellSegments value={progress}/>
    <span className="shell-byline">{t('shell.byline')}</span>
  </section>;
}
