import { useEffect, useRef, type PointerEvent } from 'react';
import type { InputCommands, TravelMode } from '../../contracts';
import { useT } from '../i18n/translate';
import { useTouchControls } from '../../game/input/useTouchControls';
import './mobile-controls.css';

interface MobileControlsProps { enabled: boolean; sprintLocked: boolean; travelMode: TravelMode; canInteract: boolean; commands: InputCommands; }
type Direction = { x: number; forward: number; label: string };

export function MobileControls({ enabled, sprintLocked, travelMode, canInteract, commands }: MobileControlsProps) {
  const t = useT();
  const mounted = travelMode !== 'foot';
  const { padHandlers, lookHandlers, directionHandlers } = useTouchControls(commands, enabled);
  const brakePointer = useRef<number | null>(null);
  useEffect(() => () => { commands.setMove('touch', 0, 0); commands.setBrake(false); }, [commands]);
  const directions: Record<string, Direction> = {
    north: { x: 0, forward: 1, label: '↑' }, west: { x: -1, forward: 0, label: '←' },
    east: { x: 1, forward: 0, label: '→' }, south: { x: 0, forward: -1, label: '↓' },
  };
  const jump = (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); commands.press('jump'); };
  const brakeStart = (event: PointerEvent<HTMLButtonElement>) => { event.preventDefault(); brakePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); commands.setBrake(true); };
  const brakeEnd = (event?: PointerEvent<HTMLButtonElement>) => { if (event && brakePointer.current !== event.pointerId) return; brakePointer.current = null; commands.setBrake(false); };
  return (
    <div className={`mobile-controls${enabled ? '' : ' is-disabled'}`} aria-hidden={!enabled}>
      <div className="mobile-controls__pad-cluster">
        <button type="button" className="mobile-controls__pad" aria-label={t('controls.move')} {...padHandlers}><span className="mobile-controls__stick" aria-hidden="true" /></button>
        <div className="mobile-controls__directions" role="group" aria-label={t('controls.move')}>
          {Object.entries(directions).map(([name, direction]) => <button key={name} type="button" className={`mobile-controls__direction mobile-controls__direction--${name}`} aria-label={`${t('controls.move')} ${name}`} {...directionHandlers(direction.x,direction.forward)}>{direction.label}</button>)}
        </div>
        <button type="button" className={`mobile-controls__sprint${sprintLocked ? ' is-active' : ''}`} aria-pressed={sprintLocked} aria-label={t('controls.sprintLock')} disabled={mounted} onClick={() => commands.press('toggleSprint')}>{t('controls.sprintLock')}</button>
      </div>
      <div className="mobile-controls__look" aria-label={t('controls.look')} {...lookHandlers}><span>{t('controls.look')}</span></div>
      <div className="mobile-controls__actions" role="group" aria-label={t('controls.move')}>
        <button type="button" className="mobile-controls__action mobile-controls__action--jump" aria-label={t('controls.jump')} disabled={!enabled || mounted} onPointerDown={jump} onClick={(event) => { if (event.detail === 0) commands.press('jump'); }}>{t('controls.jump')}</button>
        {mounted && <button type="button" className="mobile-controls__action mobile-controls__action--brake" aria-label={t('controls.brake')} onPointerDown={brakeStart} onPointerUp={brakeEnd} onPointerCancel={brakeEnd} onLostPointerCapture={brakeEnd} onBlur={()=>brakeEnd()} onKeyDown={(event) => { if ((event.key === ' ' || event.key === 'Enter') && !event.repeat) { event.preventDefault(); commands.setBrake(true); } }} onKeyUp={(event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); commands.setBrake(false); } }}>{t('controls.brake')}</button>}
        <button type="button" className="mobile-controls__action mobile-controls__action--cycle" aria-label={travelMode === 'car' ? t('controls.exitCar') : travelMode === 'bicycle' ? t('controls.dismount') : t('controls.mount')} disabled={!enabled || !canInteract} onClick={() => commands.press('interact')}>{travelMode === 'car' ? t('controls.exitCar') : travelMode === 'bicycle' ? t('controls.dismount') : t('controls.mount')}</button>
      </div>
    </div>
  );
}
export type { MobileControlsProps };
