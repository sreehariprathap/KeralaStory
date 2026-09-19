import { Suspense, lazy, useState } from 'react';
import type { Equipped, ExplorerProfile } from '../../contracts';
import type { CarModelId } from '../../content/assets/models';
import { CAR_PAINT_COLORS, VEHICLE_PROFILES } from '../../content/assets/vehicleProfiles';
import { applyEquippedCharacter, resolveEquipped, storeItems, PROCEDURAL_CHARACTER_ID, type CharacterChoiceId, type StoreKind } from '../../content/store/catalog';
import { useT, type TranslationKey } from '../i18n/translate';
import { ShellFrame } from './ShellFrame';
import { useMenuNavigation } from './useMenuNavigation';

const CarPreview = lazy(() => import('../vehicles/CarPreview').then(m => ({ default: m.CarPreview })));
const AvatarPreview = lazy(() => import('../../app/WorldCanvas').then(m => ({ default: m.AvatarPreview })));

const TABS: { kind: StoreKind; label: TranslationKey }[] = [
  { kind: 'car', label: 'shell.store.cars' },
  { kind: 'bike', label: 'shell.store.bikes' },
  { kind: 'character', label: 'shell.store.characters' },
];
const equippedIdFor = (kind: StoreKind, equipped: Equipped) => (kind === 'car' ? equipped.carId : kind === 'bike' ? equipped.bikeId : equipped.characterId);

export function StoreScreen({ equipped, coins, previewProfile, reducedMotion, onEquip, onBack }: { equipped: Equipped; coins: number; previewProfile: ExplorerProfile; reducedMotion: boolean; onEquip: (next: Equipped) => void; onBack: () => void }) {
  const t = useT();
  const resolved = resolveEquipped(equipped);
  const [tab, setTab] = useState(0);
  const kind = TABS[tab].kind;
  const items = storeItems(kind);
  const [color, setColor] = useState(resolved.carColor);
  const equip = (i: number) => {
    const id = items[i].id;
    if (kind === 'car') onEquip({ ...equipped, carId: id, carColor: color });
    else if (kind === 'bike') onEquip({ ...equipped, bikeId: id });
    else onEquip({ ...equipped, characterId: id });
  };
  const changeTab = (delta: 1 | -1) => { setTab(value => (value + delta + TABS.length) % TABS.length); setIndex(0); };
  const { index, setIndex } = useMenuNavigation({ count: items.length, onActivate: equip, onBack, onTab: changeTab });
  const selected = items[Math.min(index, items.length - 1)];
  const nameOf = (id: string, name: string) => (id === PROCEDURAL_CHARACTER_ID ? t('shell.store.explorer') : name);
  const paintable = kind === 'car' && Boolean(VEHICLE_PROFILES[selected.id as CarModelId]?.paint);

  return <ShellFrame title={t('shell.menu.store')} subtitle={<>🪙 {coins} {t('shell.store.coins')}</>} hints={t('shell.hints.store')} onBack={onBack}>
    <div className="shell-tabs" role="tablist">
      {TABS.map((entry, i) => <button key={entry.kind} role="tab" aria-selected={i === tab} className={`shell-tab ${i === tab ? 'is-active' : ''}`} onClick={() => { setTab(i); setIndex(0); }}>{t(entry.label)}</button>)}
    </div>
    <div className="shell-store">
      <ul className="shell-list" role="listbox" aria-label={t(TABS[tab].label)}>
        {items.map((entry, i) => {
          const isEquipped = equippedIdFor(kind, resolved) === entry.id;
          return <li key={entry.id} role="none">
            <button role="option" aria-selected={i === index} className={`shell-list__item ${i === index ? 'is-selected' : ''}`} onMouseEnter={() => setIndex(i)} onClick={() => setIndex(i)} onDoubleClick={() => equip(i)}>
              {nameOf(entry.id, entry.name)}
              <small className={`shell-tag ${isEquipped ? 'is-equipped' : ''}`}>{isEquipped ? t('shell.equipped') : t('shell.free')}</small>
            </button>
          </li>;
        })}
      </ul>
      <div className="shell-stage">
        <div className="shell-stage__view">
          <Suspense fallback={null}>
            {kind === 'car' && <CarPreview modelId={selected.id as CarModelId} color={paintable ? color : undefined}/>}
            {kind === 'character' && <AvatarPreview profile={applyEquippedCharacter(previewProfile, selected.id as CharacterChoiceId)} reducedMotion={reducedMotion}/>}
          </Suspense>
          {kind === 'bike' && <span className="shell-load__label">{nameOf(selected.id, selected.name)}<br/><small className="shell-frame__sub">{t('shell.store.noPreview')}</small></span>}
        </div>
        {paintable && <div className="shell-swatches" role="group" aria-label="Paint">
          {CAR_PAINT_COLORS.map(paint => <button key={paint.id} aria-label={paint.label} aria-pressed={paint.value === color} style={{ background: paint.value }} onClick={() => setColor(paint.value)}/>)}
        </div>}
        <button className="shell-button is-primary" onClick={() => equip(index)}>{t('shell.equip')}</button>
      </div>
    </div>
  </ShellFrame>;
}
