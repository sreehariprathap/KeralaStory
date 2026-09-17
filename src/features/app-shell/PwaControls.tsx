import { useEffect, useState } from 'react';
import { ArrowClockwise, ArrowsIn, ArrowsOut, DownloadSimple, Export, X } from '@phosphor-icons/react';
import { useT } from '../i18n/translate';
import { applyUpdate, downloadWorld, promptInstall, refreshCacheStatus, serviceWorkerActive, usePwa } from '../../pwa/pwaClient';
import { canFullscreen, isIosSafari, isStandalone, toggleFullscreen, useFullscreen } from '../../pwa/device';
import './pwa-controls.css';

const IOS_HINT_KEY = 'kerala-story:ios-install-hint:v1';

export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(0, Math.round(bytes / 1e3))} KB`;
}

/** "New version ready" prompt; reloading swaps in the new app shell. */
export function UpdateToast() {
  const t = useT();
  const { updateReady } = usePwa();
  const [hidden, setHidden] = useState(false);
  if (!updateReady || hidden) return null;
  return <div className="pwa-toast" role="status">
    <span>{t('pwa.updateReady')}</span>
    <button className="button button-primary" onClick={applyUpdate}><ArrowClockwise size={16}/> {t('pwa.reload')}</button>
    <button className="pwa-toast__close" aria-label={t('pwa.dismiss')} onClick={() => setHidden(true)}><X size={15}/></button>
  </div>;
}

/** Full-screen toggle; hidden where the browser has no Fullscreen API (iPhone) or the app already runs full screen. */
export function FullscreenButton({ className, landscape }: { className: string; landscape: boolean }) {
  const t = useT();
  const active = useFullscreen();
  if (!canFullscreen() || (isStandalone() && !active)) return null;
  const label = t(active ? 'pwa.exitFullscreen' : 'pwa.fullscreen');
  return <button className={className} aria-label={label} title={label} onClick={() => { void toggleFullscreen(landscape).catch(() => undefined); }}>
    {active ? <ArrowsIn size={20}/> : <ArrowsOut size={20}/>}
  </button>;
}

/** Install button (Chromium) or the Add to Home Screen hint (iOS Safari), on the title screen. */
export function InstallPrompt() {
  const t = useT();
  const { canInstall } = usePwa();
  const [iosHint, setIosHint] = useState(() => {
    if (!isIosSafari() || isStandalone()) return false;
    try { return localStorage.getItem(IOS_HINT_KEY) !== 'dismissed'; } catch { return true; }
  });
  if (canInstall) return <button className="pwa-install" onClick={() => { void promptInstall(); }}><DownloadSimple size={17} aria-hidden="true"/><span className="pwa-install__label">{t('pwa.install')}</span></button>;
  if (!iosHint) return null;
  const dismiss = () => { setIosHint(false); try { localStorage.setItem(IOS_HINT_KEY, 'dismissed'); } catch { /* private mode */ } };
  return <div className="pwa-ios-hint" role="note">
    <Export size={18} aria-hidden="true"/><span>{t('pwa.iosHint')}</span>
    <button aria-label={t('pwa.dismiss')} onClick={dismiss}><X size={14}/></button>
  </div>;
}

/** Storage summary and the whole-world download, for the settings panel. */
export function OfflineSettings() {
  const t = useT();
  const { cache, download } = usePwa();
  const available = serviceWorkerActive();
  useEffect(() => { if (available) refreshCacheStatus(); }, [available]);
  if (!available) return <p className="settings-panel__hint">{t('settings.offlineUnavailable')}</p>;
  const downloading = download !== null && download.done < download.total;
  const complete = cache !== null && cache.totalBytes > 0 && cache.cachedBytes >= cache.totalBytes;
  return <div className="pwa-offline">
    <p className="settings-panel__hint">{t('settings.offlineHint')}</p>
    {cache && <div className="pwa-offline__meter" role="meter" aria-valuemin={0} aria-valuemax={cache.totalBytes} aria-valuenow={cache.cachedBytes} aria-label={t('settings.offline')}>
      <span style={{ transform: `scaleX(${cache.totalBytes ? cache.cachedBytes / cache.totalBytes : 0})` }}/>
    </div>}
    {cache && <small>{formatBytes(cache.cachedBytes)} / {formatBytes(cache.totalBytes)} {t('settings.offlineSaved')}</small>}
    {complete ? <p className="pwa-offline__done">{t('settings.offlineComplete')}</p>
      : <button type="button" className="button button-secondary" disabled={downloading} onClick={() => { void downloadWorld(); }}>
        <DownloadSimple size={17}/> {downloading ? `${t('settings.offlineDownloading')} ${download!.done} / ${download!.total}` : `${t('settings.offlineDownload')}${cache ? ` (${formatBytes(cache.totalBytes - cache.cachedBytes)})` : ''}`}
      </button>}
    {download && !downloading && download.failed > 0 && <small role="alert">{download.failed} {t('settings.offlineFailed')}</small>}
  </div>;
}
