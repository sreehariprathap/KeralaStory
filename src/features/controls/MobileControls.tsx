import { useEffect, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ArrowFatUp, ArrowFatDown, CaretLeft, CaretRight, SignIn, SignOut, ArrowLineUp } from '@phosphor-icons/react';
import type { InputCommands, TravelMode } from '../../contracts';
import { useT } from '../i18n/translate';
import { useTouchControls } from '../../game/input/useTouchControls';
import './mobile-controls.css';

interface MobileControlsProps {
  enabled: boolean; sprintLocked: boolean; commands: InputCommands;
  travelMode: TravelMode; canInteract: boolean; opacity: number;
}

type DriveKey = 'accelerate' | 'reverse' | 'left' | 'right';

/** Hold-to-drive buttons. Each finger owns one button, so throttle and steering combine freely. */
function useDriveButtons(commands: InputCommands, active: boolean) {
  const held = useRef(new Map<number, DriveKey>());
  const apply = () => {
    const keys = new Set(held.current.values());
    const steer = Number(keys.has('right')) - Number(keys.has('left'));
    const throttle = Number(keys.has('accelerate')) - Number(keys.has('reverse'));
    commands.setMove('touch', steer, throttle);
  };
  const releaseAll = () => { held.current.clear(); commands.setMove('touch', 0, 0); };
  useEffect(() => { if (!active) releaseAll(); return releaseAll; }, [active, commands]);
  return (key: DriveKey) => {
    const release = (e: ReactPointerEvent<HTMLElement>) => {
      if (!held.current.delete(e.pointerId)) return;
      e.currentTarget.classList.remove('is-held');
      apply();
    };
    return {
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (!active) return;
        e.preventDefault(); e.stopPropagation();
        held.current.set(e.pointerId, key);
        e.currentTarget.classList.add('is-held');
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone; pointerup still releases */ }
        apply();
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu(e: ReactMouseEvent<HTMLElement>) { e.preventDefault(); },
    };
  };
}

export function MobileControls({ enabled, sprintLocked, commands, travelMode, canInteract, opacity }: MobileControlsProps) {
  const t = useT();
  const driving = travelMode === 'car' || travelMode === 'bicycle';
  const { padHandlers, lookHandlers, cancel } = useTouchControls(commands, enabled);
  // The joystick unmounts when a ride starts (and vice versa); drop any finger it still owned.
  useEffect(() => { cancel(); }, [driving, cancel]);
  const drive = useDriveButtons(commands, enabled && driving);
  useEffect(() => () => { commands.setMove('touch', 0, 0); commands.setBrake(false); }, [commands]);
  const showInteract = travelMode !== 'foot' || canInteract;
  const style = { '--touch-opacity': opacity } as CSSProperties;
  return (
    <div className={`mobile-controls${enabled ? '' : ' is-disabled'}${driving ? ' is-driving' : ''}`} style={style} aria-hidden={!enabled}>
      {/* Empty right half of the screen: drag to aim the camera. HUD buttons sit above it. */}
      <div className="mobile-controls__look" aria-label={t('controls.look')} {...lookHandlers} />

      {driving ? (
        <div className="mobile-controls__pedals">
          <button type="button" className="mobile-controls__btn mobile-controls__btn--gas" aria-label={t('controls.accelerate')} {...drive('accelerate')}><ArrowFatUp size={40} weight="fill" /></button>
          <button type="button" className="mobile-controls__btn mobile-controls__btn--brake" aria-label={t('controls.brakeReverse')} {...drive('reverse')}><ArrowFatDown size={34} weight="fill" /></button>
        </div>
      ) : (
        <div className="mobile-controls__pad-cluster">
          <button type="button" className={`mobile-controls__sprint${sprintLocked ? ' is-active' : ''}`} aria-pressed={sprintLocked} aria-label={t('controls.sprintLock')} onClick={() => commands.press('toggleSprint')}>{t('controls.sprintLock')}</button>
          <button type="button" className="mobile-controls__pad" aria-label={t('controls.move')} {...padHandlers}><span className="mobile-controls__stick" aria-hidden="true" /></button>
        </div>
      )}

      <div className="mobile-controls__right">
        {showInteract && (
          <button type="button" className={`mobile-controls__btn mobile-controls__btn--interact${travelMode === 'foot' ? ' is-offer' : ''}`}
            aria-label={t(travelMode === 'foot' ? 'controls.enterVehicle' : 'controls.exitVehicle')}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (enabled) commands.press('interact'); }}>
            {travelMode === 'foot' ? <SignIn size={30} weight="bold" /> : <SignOut size={30} weight="bold" />}
            <span>{t(travelMode === 'foot' ? 'controls.enterVehicle' : 'controls.exitVehicle')}</span>
          </button>
        )}
        {driving ? (
          <div className="mobile-controls__steer">
            <button type="button" className="mobile-controls__btn mobile-controls__btn--steer" aria-label={t('controls.steerLeft')} {...drive('left')}><CaretLeft size={42} weight="bold" /></button>
            <button type="button" className="mobile-controls__btn mobile-controls__btn--steer" aria-label={t('controls.steerRight')} {...drive('right')}><CaretRight size={42} weight="bold" /></button>
          </div>
        ) : travelMode === 'foot' && (
          <button type="button" className="mobile-controls__btn mobile-controls__btn--jump" aria-label={t('controls.jump')}
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); if (enabled) commands.press('jump'); }}><ArrowLineUp size={32} weight="bold" /></button>
        )}
      </div>
    </div>
  );
}
export type { MobileControlsProps };
