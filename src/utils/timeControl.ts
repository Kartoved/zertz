import type { Dict } from '../i18n';

/** Correspondence games are flagged by increment === -1 (per-move clock that resets each turn). */
export const CORRESPONDENCE_INCREMENT = -1;

/** Short form: "5+5", "7d", or "∞" when the game is untimed. BIGINT columns may arrive as strings. */
export function formatTimeControlShort(
  baseMs: number | string | null | undefined,
  incrementMs: number | string | null | undefined,
): string {
  if (baseMs == null || incrementMs == null || Number(baseMs) <= 0) return '∞';
  const base = Number(baseMs);
  const inc = Number(incrementMs);
  if (inc === CORRESPONDENCE_INCREMENT) return `${Math.round(base / 86_400_000)}d`;
  return `${Math.round(base / 60_000)}+${Math.round(inc / 1000)}`;
}

/** Speed category by estimated game duration (base + 40 × increment), Lichess-style. */
export function timeControlCategory(
  baseMs: number | string | null | undefined,
  incrementMs: number | string | null | undefined,
): 'blitz' | 'rapid' | 'long' | 'correspondence' | null {
  if (baseMs == null || incrementMs == null || Number(baseMs) <= 0) return null;
  const inc = Number(incrementMs);
  if (inc === CORRESPONDENCE_INCREMENT) return 'correspondence';
  const estimate = Number(baseMs) + 40 * inc;
  if (estimate < 10 * 60_000) return 'blitz';
  if (estimate < 25 * 60_000) return 'rapid';
  return 'long';
}

/** Human label: "Блиц 5+5", "Асинхронная 7d", or the localized "no clock" text. */
export function formatTimeControl(
  t: Dict,
  baseMs: number | string | null | undefined,
  incrementMs: number | string | null | undefined,
): string {
  const cat = timeControlCategory(baseMs, incrementMs);
  if (!cat) return t.noTimeControl;
  return `${t[cat]} ${formatTimeControlShort(baseMs, incrementMs)}`;
}
