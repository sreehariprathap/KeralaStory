import { useEffect, useRef } from 'react';
import type { GameSettings, InputMode } from '../../contracts';
import backgroundMusicUrl from '../../../docs/assets/bgm.mp3?url';
import { audioLevel } from './audioPolicy';

/** One looping track, controlled by the saved sound preference. */
export function AudioDirector({ settings, mode }: { settings: GameSettings; mode: InputMode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const latest = useRef({ settings, mode });
  latest.current = { settings, mode };
  const sync = useRef<() => void>(() => {});

  useEffect(() => {
    const track = audio.current;
    if (!track) return;
    let disposed = false;
    let pending = false;
    const update = () => {
      if (disposed) return;
      const { settings, mode } = latest.current;
      const level = audioLevel(settings, mode, !document.hidden);
      track.muted = level === 0;
      track.volume = level;
      if (level === 0) {
        track.pause();
      } else if (track.paused && !pending) {
        pending = true;
        // Autoplay denial or an interrupted load can retry on the next gesture.
        void track.play().catch(() => {}).finally(() => { pending = false; });
      }
    };
    sync.current = update;
    window.addEventListener('pointerdown', update);
    window.addEventListener('keydown', update);
    document.addEventListener('visibilitychange', update);
    update();
    return () => {
      disposed = true;
      sync.current = () => {};
      window.removeEventListener('pointerdown', update);
      window.removeEventListener('keydown', update);
      document.removeEventListener('visibilitychange', update);
      track.pause();
    };
  }, []);

  useEffect(() => { sync.current(); }, [settings.muted, settings.volume, mode]);
  return <audio ref={audio} src={backgroundMusicUrl} loop preload="none" aria-hidden="true" />;
}
