import { useEffect, useRef, useState } from 'react';
import { Coins, Heart } from '@phosphor-icons/react';
import type { Locale } from '../../contracts';
import type { CollectState } from '../../game/collectables/types';
import { HEART_COUNT } from '../../game/collectables/heartSpots';
import { translate } from '../i18n/translate';
import './wallet-hud.css';

export function heartsFoundToday(state: CollectState): number {
  return state.collectedIds.filter(id => id.startsWith('heart:')).length;
}

export function WalletHud({ coins, heartsFound, locale }: { coins: number; heartsFound: number; locale: Locale }) {
  const [bumped, setBumped] = useState(false);
  const previous = useRef(coins);
  useEffect(() => {
    if (coins === previous.current) return;
    previous.current = coins;
    setBumped(true);
    const id = setTimeout(() => setBumped(false), 420);
    return () => clearTimeout(id);
  }, [coins]);
  return <div className={`wallet-hud ${bumped ? 'is-bumped' : ''}`} role="status">
    <span className="wallet-hud__coins"><Coins size={18} weight="fill"/> {coins}<small>{translate('wallet.coins', locale)}</small></span>
    <span className="wallet-hud__hearts"><Heart size={13} weight="fill"/> {heartsFound} / {HEART_COUNT} <small>{translate('wallet.hearts', locale)}</small></span>
  </div>;
}
