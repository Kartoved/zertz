const FLAG_A_CODEPOINT = 0x1f1e6;
const ASCII_A_CODEPOINT = 0x41;

export function toCountryEmoji(country: string | null | undefined): string {
  if (!country) return '🌍';

  const trimmed = country.trim();
  if (!trimmed) return '🌍';

  if (trimmed === '🌍' || trimmed === '🟢') {
    return trimmed;
  }

  // Keep existing emoji values as-is.
  if (trimmed.length >= 2 && /\p{Extended_Pictographic}/u.test(trimmed)) {
    return trimmed;
  }

  const code = trimmed.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return trimmed;
  }

  const first = FLAG_A_CODEPOINT + (code.charCodeAt(0) - ASCII_A_CODEPOINT);
  const second = FLAG_A_CODEPOINT + (code.charCodeAt(1) - ASCII_A_CODEPOINT);

  return String.fromCodePoint(first, second);
}
