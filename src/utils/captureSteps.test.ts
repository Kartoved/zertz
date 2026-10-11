import { describe, it, expect } from 'vitest';
import { captureStepClick, nextCaptureJumps } from './captureSteps';
import type { CaptureMove } from '../game/types';

const cap = (from: string, to: string, captured: string): CaptureMove => ({ from, to, captured });

// From S: a single jump S→A, and two chains sharing the first jump S→X that
// split afterwards (X→Y, X→Z).
const single = [cap('S', 'A', 'm1')];
const viaY = [cap('S', 'X', 'm2'), cap('X', 'Y', 'm3')];
const viaZ = [cap('S', 'X', 'm2'), cap('X', 'Z', 'm4')];
const chains = [single, viaY, viaZ];

describe('captureSteps', () => {
  it('offers one first jump per distinct landing', () => {
    expect(nextCaptureJumps(chains, []).map(j => j.to).sort()).toEqual(['A', 'X']);
  });

  it('completes a single-jump chain on its only click', () => {
    expect(captureStepClick(chains, [], 'A')).toEqual({ kind: 'complete', chain: single });
  });

  it('steps through a shared prefix, then completes on the branch chosen', () => {
    const r1 = captureStepClick(chains, [], 'X');
    expect(r1).toEqual({ kind: 'step', path: [viaY[0]] });
    const path = (r1 as { path: CaptureMove[] }).path;
    expect(nextCaptureJumps(chains, path).map(j => j.to).sort()).toEqual(['Y', 'Z']);
    expect(captureStepClick(chains, path, 'Z')).toEqual({ kind: 'complete', chain: viaZ });
  });

  it('resets on the origin and blocks other clicks mid-chain', () => {
    const path = [viaY[0]];
    expect(captureStepClick(chains, path, 'S')).toEqual({ kind: 'reset' });
    expect(captureStepClick(chains, path, 'A')).toEqual({ kind: 'blocked' });
  });

  it('leaves non-capture clicks to the caller', () => {
    expect(captureStepClick(chains, [], 'Q')).toBeNull();
    expect(captureStepClick([], [], 'A')).toBeNull();
  });
});
