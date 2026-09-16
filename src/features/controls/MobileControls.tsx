import { useEffect } from 'react';
import type { InputCommands } from '../../contracts';
import { useT } from '../i18n/translate';
import { useTouchControls } from '../../game/input/useTouchControls';
import './mobile-controls.css';

interface MobileControlsProps { enabled: boolean; sprintLocked: boolean; commands: InputCommands; }

export function MobileControls({ enabled, sprintLocked, commands }: MobileControlsProps) {
  const t = useT();
  const { padHandlers } = useTouchControls(commands, enabled);
  useEffect(() => () => { commands.setMove('touch', 0, 0); commands.setBrake(false); }, [commands]);
  return (
    <div className={`mobile-controls${enabled ? '' : ' is-disabled'}`} aria-hidden={!enabled}>
      <div className="mobile-controls__pad-cluster">
        <button type="button" className="mobile-controls__pad" aria-label={t('controls.move')} {...padHandlers}><span className="mobile-controls__stick" aria-hidden="true" /></button>
        <button type="button" className={`mobile-controls__sprint${sprintLocked ? ' is-active' : ''}`} aria-pressed={sprintLocked} aria-label={t('controls.sprintLock')} onClick={() => commands.press('toggleSprint')}>{t('controls.sprintLock')}</button>
      </div>
    </div>
  );
}
export type { MobileControlsProps };
