import { Language, useUIStore } from './store/uiStore';
import { ru } from './locales/ru';
import { en } from './locales/en';
import { eo } from './locales/eo';

export const LANGUAGE_LOCALE: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  eo: 'eo',
};

export type Dict = typeof ru;

export const I18N: Record<Language, Dict> = {
  ru,
  en,
  eo,
};

export function useI18n() {
  const language = useUIStore((s) => s.language);
  return {
    language,
    t: I18N[language],
    locale: LANGUAGE_LOCALE[language],
  };
}

export function getI18nFromStorage() {
  const saved = localStorage.getItem('zertz_language');
  const language: Language = saved === 'ru' || saved === 'eo' || saved === 'en' ? saved : 'en';
  return {
    language,
    t: I18N[language],
    locale: LANGUAGE_LOCALE[language],
  };
}

export function getWinTypeLabel(t: Dict, winType: string | null | undefined): string {
  if (winType === 'white') return t.winByWhite;
  if (winType === 'gray') return t.winByGray;
  if (winType === 'black') return t.winByBlack;
  if (winType === 'mixed') return t.winByMixed;
  if (winType === 'time') return t.winByTime;
  return t.winUnknown;
}
