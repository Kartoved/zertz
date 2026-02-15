const FLAG_A_CODEPOINT = 0x1f1e6;
const ASCII_A_CODEPOINT = 0x41;

export function normalizeCountryValue(country: string | null | undefined): string {
  if (!country) return '🌍';

  const trimmed = country.trim();
  if (!trimmed) return '🌍';

  if (trimmed === '🌍' || trimmed === '🟢') {
    return trimmed;
  }

  const codePoints = Array.from(trimmed);
  if (codePoints.length === 2) {
    const first = codePoints[0].codePointAt(0);
    const second = codePoints[1].codePointAt(0);
    if (
      first != null &&
      second != null &&
      first >= FLAG_A_CODEPOINT &&
      first <= FLAG_A_CODEPOINT + 25 &&
      second >= FLAG_A_CODEPOINT &&
      second <= FLAG_A_CODEPOINT + 25
    ) {
      const aCode = ASCII_A_CODEPOINT;
      return String.fromCharCode((first - FLAG_A_CODEPOINT) + aCode, (second - FLAG_A_CODEPOINT) + aCode);
    }
  }

  const code = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) {
    return code;
  }

  return trimmed;
}

export function toCountryEmoji(country: string | null | undefined): string {
  const normalized = normalizeCountryValue(country);

  if (normalized === '🌍' || normalized === '🟢') {
    return normalized;
  }

  // Keep existing emoji values as-is.
  if (normalized.length >= 2 && /\p{Extended_Pictographic}/u.test(normalized)) {
    return normalized;
  }

  const code = normalized.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return normalized;
  }

  const first = FLAG_A_CODEPOINT + (code.charCodeAt(0) - ASCII_A_CODEPOINT);
  const second = FLAG_A_CODEPOINT + (code.charCodeAt(1) - ASCII_A_CODEPOINT);

  return String.fromCodePoint(first, second);
}

export function getCountryFlagImageUrl(country: string | null | undefined): string | null {
  const normalized = normalizeCountryValue(country);
  if (/^[A-Z]{2}$/.test(normalized)) {
    return `https://flagcdn.com/24x18/${normalized.toLowerCase()}.png`;
  }
  return null;
}
