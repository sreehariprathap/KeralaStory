import { useEffect, useRef, useState } from 'react';
import { Coins, Heart, MapPin } from '@phosphor-icons/react';
import type { Locale } from '../../contracts';
import type { CollectState } from '../../game/collectables/types';
import { HEART_COUNT } from '../../game/collectables/heartSpots';
import { translate } from '../i18n/translate';
import './wallet-hud.css';

export function heartsFoundToday(state: CollectState): number {
  return state.collectedIds.filter(id => id.startsWith('heart:')).length;
}

/** `compact` folds place, coins and hearts into one small pill for touch screens. */
export function WalletHud({ coins, heartsFound, locale, compact = false, place }: { coins: number; heartsFound: number; locale: Locale; compact?: boolean; place?: string }) {
  const [bumped, setBumped] = useState(false);
  const previous = useRef(coins);
  useEffect(() => {
    if (coins === previous.current) return;
    previous.current = coins;
    setBumped(true);
    const id = setTimeout(() => setBumped(false), 420);
    return () => clearTimeout(id);
  }, [coins]);
  return <div className={`wallet-hud ${bumped ? 'is-bumped' : ''} ${compact ? 'is-compact' : ''}`} role="status">
    {compact && place && <span className="wallet-hud__place"><MapPin size={14} weight="fill"/> {place}</span>}
    <span className="wallet-hud__coins"><Coins size={compact ? 15 : 18} weight="fill"/> {coins}<small>{translate('wallet.coins', locale)}</small></span>
    <span className="wallet-hud__hearts"><Heart size={13} weight="fill"/> {heartsFound} / {HEART_COUNT} <small>{translate('wallet.hearts', locale)}</small></span>
  </div>;
}
