import { createContext, createElement, useContext, useMemo, type PropsWithChildren } from 'react';
import type { Locale, ZoneId } from '../../contracts';
import englishCatalog from '../../content/locales/en.json';
import malayalamCatalog from '../../content/locales/ml.json';

/** The English sheet is the stable source of translation keys. */
export const ENGLISH_CATALOG = englishCatalog;
export const MALAYALAM_CATALOG = malayalamCatalog;
export type TranslationKey = keyof typeof ENGLISH_CATALOG;

export function translateFromCatalog<K extends string>(key: K, locale: Locale, english: Record<K, string>, malayalam: Partial<Record<K, string>>): string {
  const fallback = english[key];
  if (locale === 'ml') {
    const value = malayalam[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
}

export function translate(key: TranslationKey, locale: Locale): string {
  return translateFromCatalog(key, locale, ENGLISH_CATALOG, MALAYALAM_CATALOG);
}

export function localizedPlace(id: string, locale: Locale): string {
  const key = `place.${id}` as TranslationKey;
  return key in ENGLISH_CATALOG ? translate(key, locale) : id;
}

/** Prefer a reviewed short map label, while retaining a reviewed full place name as fallback. */
export function localizedMapPlace(id: string, locale: Locale, english: Record<string, string> = ENGLISH_CATALOG, malayalam: Partial<Record<string, string>> = MALAYALAM_CATALOG): string {
  const candidates = locale === 'ml'
    ? [malayalam[`map.place.${id}`], malayalam[`place.${id}`], english[`map.place.${id}`], english[`place.${id}`]]
    : [english[`map.place.${id}`], english[`place.${id}`]];
  const value = candidates.find(candidate => typeof candidate === 'string' && candidate.trim());
  return value?.trim() ?? id;
}

export function localizedRegion(id: ZoneId | string, locale: Locale): string {
  const key = `region.${id}` as TranslationKey;
  return key in ENGLISH_CATALOG ? translate(key, locale) : id;
}

type LocaleContextValue = { locale: Locale; t: (key: TranslationKey) => string };
const LocaleContext = createContext<LocaleContextValue>({ locale: 'en', t: key => translate(key, 'en') });

export function LocaleProvider({ locale, children }: PropsWithChildren<{ locale: Locale }>) {
  const value = useMemo<LocaleContextValue>(() => ({ locale, t: key => translate(key, locale) }), [locale]);
  return createElement(LocaleContext.Provider, { value }, children);
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

export function useT(): (key: TranslationKey) => string {
  return useLocale().t;
}
