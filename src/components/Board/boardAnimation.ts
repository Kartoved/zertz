import type { GameState, MarbleColor } from '../../game/types';

// Pure "what changed between two positions" → animation plan for HexBoard.
// Only a single forward step is animated (a placement, a ring removal, one or
// more capture jumps, isolation captures). Anything else — going back in
// history, jumping several moves, loading a game — returns null and the board
// just switches instantly.

export interface RingSnap {
  color: MarbleColor | null;
  removed: boolean;
}
export type BoardSnap = Map<string, RingSnap>;

export const HOP_MS = 170;
const POP_MS = 220;
const VANISH_MS = 320;

export interface BoardAnim {
  /** Ring whose marble animates in: 'pop' for a placement, 'appear' when the
   *  flying copy lands there (the real marble stays hidden until then). */
  dest: { id: string; kind: 'pop' | 'appear'; delayMs: number } | null;
  /** A marble flying along `path` (ring ids), one hop per jump. */
  flight: { color: MarbleColor; path: string[]; hopMs: number } | null;
  /** Marbles that disappear (captured / isolated). */
  vanishMarbles: { id: string; color: MarbleColor; delayMs: number }[];
  /** Rings that disappear (removed). */
  vanishRings: { id: string; delayMs: number }[];
  /** When everything has finished. */
  totalMs: number;
}

export function snapshotBoard(state: GameState): BoardSnap {
  const snap: BoardSnap = new Map();
  for (const r of state.rings.values()) {
    snap.set(r.id, { color: r.isRemoved ? null : r.marble?.color ?? null, removed: r.isRemoved });
  }
  return snap;
}

/**
 * @param hintPath ring ids of the jump path that produced `next`, if known
 *   (the last move or the latest clicked jump). Used to fly the marble hop by
 *   hop; the part of it before the marble's actual origin is ignored.
 */
export function diffBoards(prev: BoardSnap, next: BoardSnap, hintPath: string[] | null): BoardAnim | null {
  if (prev.size !== next.size) return null;
  const appeared: string[] = [];
  const gone: string[] = [];
  const removedRings: string[] = [];
  for (const [id, b] of next) {
    const a = prev.get(id);
    if (!a) return null;
    if (a.removed && !b.removed) return null; // a ring came back → going backwards
    if (!a.removed && b.removed) removedRings.push(id);
    if (!a.color && b.color) appeared.push(id);
    if (a.color && !b.color) gone.push(id);
  }
  if (appeared.length > 1 || removedRings.length > 3 || gone.length > 12) return null;
  // Marbles only vanish on their own when a ring removal isolates them; without
  // anything appearing or a ring going away this is a step backwards.
  if (appeared.length === 0 && removedRings.length === 0) return null;

  const anim: BoardAnim = { dest: null, flight: null, vanishMarbles: [], vanishRings: [], totalMs: 0 };
  let t = 0;
  const goneSet = new Set(gone);

  if (appeared.length === 1) {
    const destId = appeared[0];
    const color = next.get(destId)!.color!;
    // The flight starts at the last path ring the moving marble actually left.
    let path: string[] | null = null;
    if (hintPath && hintPath.length > 1 && hintPath[hintPath.length - 1] === destId) {
      const start = hintPath.findIndex(id => goneSet.has(id) && prev.get(id)!.color === color);
      if (start >= 0 && start < hintPath.length - 1) path = hintPath.slice(start);
    }
    if (path) {
      const hops = path.length - 1;
      anim.flight = { color, path, hopMs: HOP_MS };
      anim.dest = { id: destId, kind: 'appear', delayMs: hops * HOP_MS };
      goneSet.delete(path[0]);
      // Each captured marble fades as the marble jumps over it (mid-hop).
      for (let i = 0; i < hops; i++) {
        const captured = gone.find(id => goneSet.has(id) && isBetween(path![i], path![i + 1], id, prev));
        if (captured) {
          anim.vanishMarbles.push({ id: captured, color: prev.get(captured)!.color!, delayMs: i * HOP_MS + HOP_MS / 2 });
          goneSet.delete(captured);
        }
      }
      t = hops * HOP_MS;
    } else if (gone.length === 0 || removedRings.length > 0) {
      anim.dest = { id: destId, kind: 'pop', delayMs: 0 };
      t = POP_MS;
    } else {
      return null; // a marble moved without a known path — don't guess
    }
  }

  // Ring removal (after the placement pop), then isolation captures with it.
  const ringDelay = anim.dest?.kind === 'pop' ? POP_MS * 0.6 : t;
  for (const id of removedRings) anim.vanishRings.push({ id, delayMs: ringDelay });
  for (const id of goneSet) {
    anim.vanishMarbles.push({ id, color: prev.get(id)!.color!, delayMs: removedRings.length ? ringDelay : t });
  }
  const lastVanish = Math.max(
    0,
    ...anim.vanishRings.map(v => v.delayMs + VANISH_MS),
    ...anim.vanishMarbles.map(v => v.delayMs + VANISH_MS),
  );
  anim.totalMs = Math.max(t, lastVanish);
  return anim;
}

// Ring ids are "q,r" axial coordinates; the captured ring of a hop is the
// midpoint of its two landing rings.
function isBetween(from: string, to: string, mid: string, snap: BoardSnap): boolean {
  if (!snap.has(mid)) return false;
  const [fq, fr] = from.split(',').map(Number);
  const [tq, tr] = to.split(',').map(Number);
  const [mq, mr] = mid.split(',').map(Number);
  return fq + tq === 2 * mq && fr + tr === 2 * mr;
}
