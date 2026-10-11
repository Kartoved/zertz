import { useId } from 'react';
import type { MarbleColor } from '../../game/types';

// Marbles styled after the physical ZERTZ set: matte ivory white, light speckled
// "granite" gray, and blue-black with light flecks. Pure SVG gradients plus a
// speckle <pattern> (no filters — cheap enough for many boards on one page).
// <MarbleDefs prefix> must be rendered once inside the <svg> that uses <Marble>.

const SPECK_TILE = 40;

// Deterministic PRNG so every render (and server-side snapshot) looks the same.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Speck = { x: number; y: number; r: number; fill: string; o: number };

function makeSpecks(seed: number, count: number, palette: { fill: string; weight: number; rMin: number; rMax: number; o: number }[]): Speck[] {
  const rnd = mulberry32(seed);
  const total = palette.reduce((s, p) => s + p.weight, 0);
  const out: Speck[] = [];
  for (let i = 0; i < count; i++) {
    let pick = rnd() * total;
    const p = palette.find(c => (pick -= c.weight) < 0) ?? palette[0];
    out.push({ x: rnd() * SPECK_TILE, y: rnd() * SPECK_TILE, r: p.rMin + rnd() * (p.rMax - p.rMin), fill: p.fill, o: p.o });
  }
  return out;
}

const GRAY_SPECKS = makeSpecks(7, 190, [
  { fill: '#3d4658', weight: 6, rMin: 0.3, rMax: 0.9, o: 0.85 },
  { fill: '#1c2230', weight: 3, rMin: 0.25, rMax: 0.7, o: 0.9 },
  { fill: '#f4f6fa', weight: 3, rMin: 0.25, rMax: 0.75, o: 0.8 },
]);
const BLACK_SPECKS = makeSpecks(13, 70, [
  { fill: '#c9d6f2', weight: 5, rMin: 0.25, rMax: 0.75, o: 0.8 },
  { fill: '#7f96c4', weight: 4, rMin: 0.35, rMax: 1.0, o: 0.7 },
  { fill: '#ffffff', weight: 1, rMin: 0.25, rMax: 0.55, o: 0.9 },
]);

export const MARBLE_STROKE: Record<MarbleColor, string> = {
  white: '#a89e8f',
  gray: '#6e7582',
  black: '#0a0f1c',
};

const id = (prefix: string, key: string) => `${prefix}-mb-${key}`;

export function MarbleDefs({ prefix }: { prefix: string }) {
  return (
    <defs>
      {/* Base body colour, lit from the upper left */}
      <radialGradient id={id(prefix, 'white-base')} cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#fdfbf6" />
        <stop offset="55%" stopColor="#efe9de" />
        <stop offset="85%" stopColor="#d7cebf" />
        <stop offset="100%" stopColor="#bdb2a2" />
      </radialGradient>
      <radialGradient id={id(prefix, 'gray-base')} cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#d2d7e0" />
        <stop offset="60%" stopColor="#a4acba" />
        <stop offset="100%" stopColor="#737c8c" />
      </radialGradient>
      <radialGradient id={id(prefix, 'black-base')} cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#4d5d80" />
        <stop offset="55%" stopColor="#25314c" />
        <stop offset="100%" stopColor="#0e1525" />
      </radialGradient>

      {/* Speckle textures (tiled in user space; each marble rotates its copy) */}
      <pattern id={id(prefix, 'gray-speck')} width={SPECK_TILE} height={SPECK_TILE} patternUnits="userSpaceOnUse">
        {GRAY_SPECKS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.fill} opacity={s.o} />)}
      </pattern>
      <pattern id={id(prefix, 'black-speck')} width={SPECK_TILE} height={SPECK_TILE} patternUnits="userSpaceOnUse">
        {BLACK_SPECKS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.fill} opacity={s.o} />)}
      </pattern>

      {/* Rim shading — rounds the body */}
      <radialGradient id={id(prefix, 'shade')} cx="42%" cy="38%" r="68%">
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
      </radialGradient>
      {/* Highlights: broad and soft on the matte white, tighter on the glossy ones */}
      <radialGradient id={id(prefix, 'white-hl')} cx="34%" cy="28%" r="45%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id(prefix, 'gray-hl')} cx="32%" cy="26%" r="30%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <radialGradient id={id(prefix, 'black-hl')} cx="32%" cy="26%" r="28%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** A marble centred at (0, 0). `seed` (e.g. derived from the ring id) rotates
 *  the speckle texture so neighbouring marbles don't look identical. */
export function Marble({ prefix, color, r, seed = 0, opacity }: {
  prefix: string;
  color: MarbleColor;
  r: number;
  seed?: number;
  opacity?: number;
}) {
  return (
    <g opacity={opacity}>
      <circle r={r} fill={`url(#${id(prefix, `${color}-base`)})`} />
      {color !== 'white' && (
        <g transform={`rotate(${(seed * 47) % 360})`}>
          <circle r={r} fill={`url(#${id(prefix, `${color}-speck`)})`} />
        </g>
      )}
      <circle r={r} fill={`url(#${id(prefix, 'shade')})`} />
      <circle r={r} fill={`url(#${id(prefix, `${color}-hl`)})`} stroke={MARBLE_STROKE[color]} strokeWidth={1} />
    </g>
  );
}

/** Stable small number from a ring id, for <Marble seed>. */
export function seedFromId(ringId: string): number {
  let h = 0;
  for (let i = 0; i < ringId.length; i++) h = (h * 31 + ringId.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Standalone marble icon (marble picker etc.). */
export function MarbleIcon({ color, size = 40 }: { color: MarbleColor; size?: number }) {
  const prefix = `mi${useId().replace(/:/g, '')}`;
  // Same radius as on the board (~16 user units) so the speckle density matches.
  return (
    <svg width={size} height={size} viewBox="-18 -18 36 36" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))' }}>
      <MarbleDefs prefix={prefix} />
      <Marble prefix={prefix} color={color} r={16.5} seed={color.length} />
    </svg>
  );
}
