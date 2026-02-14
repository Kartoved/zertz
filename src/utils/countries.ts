import { Language } from '../store/uiStore';

export type CountryOption = { code: string; name: string };

const SPECIAL_COUNTRIES: Record<Language, CountryOption[]> = {
  ru: [
    { code: '🌍', name: 'Земля' },
    { code: '🟢', name: 'Эсперантия' },
  ],
  en: [
    { code: '🌍', name: 'Earth' },
    { code: '🟢', name: 'Esperantujo' },
  ],
  eo: [
    { code: '🌍', name: 'Tero' },
    { code: '🟢', name: 'Esperantujo' },
  ],
};

const LOCALE_BY_LANGUAGE: Record<Language, string> = {
  ru: 'ru',
  en: 'en',
  eo: 'eo',
};

let cachedIsoCodes: string[] | null = null;

function buildIsoCodes(): string[] {
  const formatter = new Intl.DisplayNames(['en'], { type: 'region' });
  const codes: string[] = [];

  for (let a = 65; a <= 90; a += 1) {
    for (let b = 65; b <= 90; b += 1) {
      const code = String.fromCharCode(a, b);
      const name = formatter.of(code);
      if (!name || name === code) continue;
      codes.push(code);
    }
  }

  return codes.sort();
}

function getIsoCodes(): string[] {
  if (!cachedIsoCodes) cachedIsoCodes = buildIsoCodes();
  return cachedIsoCodes;
}

export function getCountryOptions(language: Language): CountryOption[] {
  const locale = LOCALE_BY_LANGUAGE[language];
  const formatter = new Intl.DisplayNames([locale, 'en'], { type: 'region' });

  const countries = getIsoCodes().map((code) => ({
    code,
    name: formatter.of(code) ?? code,
  }));

  countries.sort((a, b) => a.name.localeCompare(b.name, locale));

  return [...SPECIAL_COUNTRIES[language], ...countries];
}
