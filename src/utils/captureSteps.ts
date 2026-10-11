import type { CaptureMove } from '../game/types';

// Jump-by-jump capture input. The player clicks every landing of a capture
// chain in turn instead of only the final one. `chains` are the maximal chains
// from the selected marble (getCaptureChains); `path` is the jumps taken so far.
//
// A landing sequence identifies a chain uniquely (each jump captures the marble
// between its from/to), and no maximal chain is a strict prefix of another (the
// position after a shared prefix is identical), so a path that equals a whole
// chain is always complete.

function hasPrefix(chain: CaptureMove[], path: CaptureMove[]): boolean {
  if (chain.length < path.length) return false;
  return path.every((j, i) => chain[i].from === j.from && chain[i].to === j.to);
}

/** The jumps that may follow `path`, one per distinct landing ring. */
export function nextCaptureJumps(chains: CaptureMove[][], path: CaptureMove[]): CaptureMove[] {
  const byLanding = new Map<string, CaptureMove>();
  for (const chain of chains) {
    if (chain.length > path.length && hasPrefix(chain, path)) {
      const jump = chain[path.length];
      if (!byLanding.has(jump.to)) byLanding.set(jump.to, jump);
    }
  }
  return [...byLanding.values()];
}

export type CaptureStepResult =
  | { kind: 'step'; path: CaptureMove[] }       // jump taken, chain continues
  | { kind: 'complete'; chain: CaptureMove[] }  // last jump — submit this chain
  | { kind: 'reset' }                           // origin clicked mid-chain — start over
  | { kind: 'blocked' }                         // mid-chain click elsewhere — ignore it
  | null;                                       // not a capture click; caller handles it

export function captureStepClick(chains: CaptureMove[][], path: CaptureMove[], ringId: string): CaptureStepResult {
  if (chains.length === 0) return null;
  const jump = nextCaptureJumps(chains, path).find(j => j.to === ringId);
  if (jump) {
    const nextPath = [...path, jump];
    const full = chains.find(c => c.length === nextPath.length && hasPrefix(c, nextPath));
    return full ? { kind: 'complete', chain: full } : { kind: 'step', path: nextPath };
  }
  if (path.length === 0) return null;
  return ringId === path[0].from ? { kind: 'reset' } : { kind: 'blocked' };
}
