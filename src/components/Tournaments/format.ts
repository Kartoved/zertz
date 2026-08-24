// Shared arena time formatting (used by the list + detail screens).

// Countdown from `now` to `target` (both epoch ms) as H:MM:SS / M:SS.
export function fmtCountdown(target: number, now: number): string {
  const ms = Math.max(0, target - now);
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
