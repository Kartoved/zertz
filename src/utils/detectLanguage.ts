import type { Language } from '../store/uiStore';

// Languages whose speakers are overwhelmingly more comfortable with Russian
// than with English. Ukrainian (`uk`) is deliberately NOT here: someone whose
// browser is set to Ukrainian has made a language choice, and Russian is a poor
// default to force on them — they fall through to English like everyone else.
const RU_LANGUAGE_PREFIXES = ['ru', 'be', 'kk', 'ky', 'uz', 'tg', 'tk', 'hy', 'az', 'os', 'ab'];

// Fallback signal for a browser reporting e.g. `en-US` while the user is
// physically in the region — a common state on phones and on Windows builds
// shipped with an English UI. Same exclusion for Kyiv as above.
const RU_TIME_ZONES = [
  'Europe/Moscow', 'Europe/Kaliningrad', 'Europe/Samara', 'Europe/Volgograd',
  'Europe/Saratov', 'Europe/Astrakhan', 'Europe/Ulyanovsk', 'Europe/Kirov',
  'Europe/Minsk', 'Europe/Chisinau', 'Europe/Tiraspol',
  'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Novosibirsk', 'Asia/Novokuznetsk',
  'Asia/Barnaul', 'Asia/Tomsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk',
  'Asia/Chita', 'Asia/Yakutsk', 'Asia/Khandyga', 'Asia/Vladivostok',
  'Asia/Ust-Nera', 'Asia/Magadan', 'Asia/Sakhalin', 'Asia/Srednekolymsk',
  'Asia/Kamchatka', 'Asia/Anadyr',
  'Asia/Almaty', 'Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Atyrau', 'Asia/Oral',
  'Asia/Qostanay', 'Asia/Qyzylorda',
  'Asia/Bishkek', 'Asia/Tashkent', 'Asia/Samarkand', 'Asia/Dushanbe',
  'Asia/Ashgabat', 'Asia/Yerevan', 'Asia/Baku', 'Asia/Tbilisi',
];

/**
 * Language for a first-time visitor with nothing stored yet: Russian for
 * Russia/CIS, English for everyone else. Esperanto is never auto-picked — it
 * is always an explicit choice.
 *
 * Called once, at store init; afterwards the user's saved choice always wins,
 * so switching the language sticks even inside the detected region.
 */
export function detectLanguage(): Language {
  try {
    const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const tag of tags) {
      if (!tag) continue;
      const primary = tag.toLowerCase().split('-')[0];
      // The first EXPLICIT hit wins: a `uk, en` browser must not match `ru`
      // further down the list, and an `en, ru` one stays English.
      if (RU_LANGUAGE_PREFIXES.includes(primary)) return 'ru';
      if (primary === 'en' || primary === 'uk') return 'en';
    }
  } catch {
    /* ancient/locked-down browser — fall through to the timezone check */
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && RU_TIME_ZONES.includes(tz)) return 'ru';
  } catch {
    /* no Intl — English it is */
  }

  return 'en';
}
