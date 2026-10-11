import { useEffect } from 'react';
import { create } from 'zustand';
import type { CaptureMove, GameNode } from '../game/types';

// Which jump of a multi-jump capture the board is showing while the user steps
// through the move list. Shared by the move lists (which set it) and the board
// screens (which render it). `step` k (1…jumps-1) means "after k jumps"; null
// means the node's own, final position. The view is tied to one node id (ids
// survive the online poll re-deserializing the tree) and ignored for any other
// node, so ordinary navigation can never show a stale step.

interface CaptureStepViewState {
  nodeId: string | null;
  step: number | null;
  show: (node: GameNode | null, step: number | null) => void;
}

export const useCaptureStepView = create<CaptureStepViewState>(set => ({
  nodeId: null,
  step: null,
  show: (node, step) => set(step == null || !node ? { nodeId: null, step: null } : { nodeId: node.id, step }),
}));

/** The step shown for `node`, or null when it shows its final position. */
export function useStepFor(node: GameNode): number | null {
  return useCaptureStepView(s => (s.nodeId === node.id ? s.step : null));
}

/** All jumps of a capture node with at least two jumps; null otherwise. */
export function captureJumps(node: GameNode | null | undefined): CaptureMove[] | null {
  if (!node?.move || node.move.type !== 'capture') return null;
  const jumps = [node.move.data, ...(node.move.data.chain || [])];
  return jumps.length > 1 ? jumps : null;
}

/** ← : back one jump inside a chain; from a chain's final position, to its last-but-one jump; otherwise to the parent move. */
export function stepBack(current: GameNode, step: number | null, navigate: (n: GameNode) => void): void {
  const { show } = useCaptureStepView.getState();
  if (step != null) {
    if (step > 1) show(current, step - 1);
    else if (current.parent) { show(null, null); navigate(current.parent); }
    return;
  }
  const jumps = captureJumps(current);
  if (jumps) { show(current, jumps.length - 1); return; }
  if (current.parent) { show(null, null); navigate(current.parent); }
}

/** → : forward one jump inside a chain; entering a chain starts at its first jump. */
export function stepForward(current: GameNode, step: number | null, navigate: (n: GameNode) => void): void {
  const { show } = useCaptureStepView.getState();
  if (step != null) {
    const jumps = captureJumps(current);
    show(jumps && step + 1 < jumps.length ? current : null, jumps && step + 1 < jumps.length ? step + 1 : null);
    return;
  }
  const child = current.children[0];
  if (!child) return;
  show(null, null);
  navigate(child);
  if (captureJumps(child)) show(child, 1);
}

/** Navigate to a node from a list click: always lands on the node's final position. */
export function navigateWhole(node: GameNode, navigate: (n: GameNode) => void): void {
  useCaptureStepView.getState().show(null, null);
  navigate(node);
}

/** The sub-step shown for `activeNode`, if any. Clears a view left on another node. */
export function useActiveCaptureStep(activeNode: GameNode): { step: number; jumps: CaptureMove[] } | null {
  const nodeId = useCaptureStepView(s => s.nodeId);
  const step = useCaptureStepView(s => s.step);
  useEffect(() => {
    if (nodeId && nodeId !== activeNode.id) useCaptureStepView.getState().show(null, null);
  }, [nodeId, activeNode.id]);
  if (nodeId !== activeNode.id || step == null) return null;
  const jumps = captureJumps(activeNode);
  return jumps ? { step, jumps } : null;
}
