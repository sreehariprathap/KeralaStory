import { describe, expect, it } from 'vitest';
import { heartsFoundToday } from '../src/features/wallet/WalletHud';
import { ENGLISH_CATALOG, MALAYALAM_CATALOG } from '../src/features/i18n/translate';

describe('wallet hud', () => {
  it('counts only the hearts among the day\'s finds', () => {
    expect(heartsFoundToday({ coins: 30, dateKey: '2026-09-16', collectedIds: ['coin:2026-09-16:1', 'heart:jetty', 'heart:quay'] })).toBe(2);
  });

  it('has wallet strings in both catalogs', () => {
    for (const key of ['wallet.coins', 'wallet.hearts'] as const) {
      expect(ENGLISH_CATALOG[key]).toBeTruthy();
      expect(MALAYALAM_CATALOG[key]).toBeTruthy();
    }
  });
});
