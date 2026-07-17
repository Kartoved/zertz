import { describe, it, expect } from 'vitest';
import { pickCaptureChain } from './analysisActions';
import { GameNode, CaptureMove, Move } from '../game/types';

const cap = (from: string, to: string, captured: string): CaptureMove => ({ from, to, captured });

// Two distinct maximal chains from S that both end on 'A':
const chainA: CaptureMove[] = [cap('S', 'A', 'M1')];              // single jump S→A
const chainB: CaptureMove[] = [cap('S', 'X', 'M2'), cap('X', 'A', 'M3')]; // S→X→A
const chainC: CaptureMove[] = [cap('S', 'B', 'M4')];              // S→B (different terminal)

function nodeWithCaptureChild(chain: CaptureMove[]): GameNode {
  const move: Move = { type: 'capture', data: { ...chain[0], chain: chain.slice(1) } };
  const root = { id: 'r', moveNumber: 1, player: 'player1', move: null, notation: '', children: [] as GameNode[], parent: null, isMainLine: true } as GameNode;
  root.children.push({ id: 'c', moveNumber: 2, player: 'player2', move, notation: '', children: [], parent: root, isMainLine: true } as GameNode);
  return root;
}

describe('pickCaptureChain', () => {
  it('returns the only chain ending on the clicked terminal', () => {
    expect(pickCaptureChain([chainA, chainC], 'B', undefined)).toBe(chainC);
    expect(pickCaptureChain([chainA], 'A', undefined)).toBe(chainA);
  });

  it('without a node, falls back to the first same-terminal chain', () => {
    expect(pickCaptureChain([chainA, chainB], 'A', null)).toBe(chainA);
  });

  it('with a node, prefers a NOT-yet-built same-terminal branch', () => {
    // chainA is already a child → clicking terminal A should offer chainB.
    const node = nodeWithCaptureChild(chainA);
    expect(pickCaptureChain([chainA, chainB], 'A', node)).toBe(chainB);
    // And symmetrically if chainB is the existing branch.
    const node2 = nodeWithCaptureChild(chainB);
    expect(pickCaptureChain([chainA, chainB], 'A', node2)).toBe(chainA);
  });

  it('when both same-terminal branches already exist, returns the first (no new branch)', () => {
    const node = nodeWithCaptureChild(chainA);
    node.children.push({
      id: 'c2', moveNumber: 2, player: 'player2',
      move: { type: 'capture', data: { ...chainB[0], chain: chainB.slice(1) } },
      notation: '', children: [], parent: node, isMainLine: false,
    } as GameNode);
    expect(pickCaptureChain([chainA, chainB], 'A', node)).toBe(chainA);
  });
});
