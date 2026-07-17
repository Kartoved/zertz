import { GameState, GameNode, MarbleColor, CaptureMove, PreMoveNode, PreMoveTree } from '../game/types';
import { getCaptureChains } from '../game/GameEngine';
import { getValidRemovableRings } from '../game/Board';
import { applyPlacement, applyRingRemoval, applyCapture, normalizePhase } from '../utils/moveActions';
import { addMoveToTree, rebuildStateFromNode } from '../utils/gameTreeUtils';

export interface AnalysisSelectionSlice {
  selectedRingId: string | null;
  highlightedCaptures: CaptureMove[];
  availableCaptureChains?: CaptureMove[][];
}

export interface AnalysisMoveResult {
  analysisState: GameState;
  analysisCurrentNode?: GameNode;
}

// Mutates `startNode` in place: injects the saved pre-move tree as branches so
// the user can navigate them in the move-history widget. Pre-move nodes sharing
// a prefix collapse onto the same game-tree nodes.
export function injectPremovesIntoTree(startNode: GameNode, premoves: PreMoveTree | null): void {
  if (!premoves) return;
  const walk = (parent: GameNode, pmNodes: PreMoveNode[]): void => {
    for (const pm of pmNodes) {
      let target = parent.children.find(c =>
        c.move && JSON.stringify(c.move) === JSON.stringify(pm.move)
      );
      if (!target) {
        target = {
          id: `pm-${pm.id}`,
          moveNumber: parent.moveNumber + 1,
          player: pm.player,
          move: pm.move,
          notation: pm.notation,
          children: [],
          parent,
          isMainLine: parent.children.length === 0,
        };
        parent.children.push(target);
      }
      walk(target, pm.children);
    }
  };
  walk(startNode, premoves.children);
}

// Picks which capture chain the user meant when they clicked a terminal landing.
// Chains are disambiguated by their terminal `to`, BUT two distinct maximal chains
// from the same marble can share a terminal (different intermediate jumps that
// reconverge). When building variations (analysis/premoves), that ambiguity makes
// a second same-terminal branch unaddable — `.find` always returns the first.
//
// So when several chains end on the clicked ring, prefer one that isn't already a
// child of `currentNode` (i.e. a NOT-yet-built branch); fall back to the first.
// Pass `currentNode` only where branching matters (analysis); omit for live play.
function captureKey(from: string, landings: string[]): string {
  return `${from}:${landings.join('>')}`;
}

export function pickCaptureChain(
  chains: CaptureMove[][],
  terminalRingId: string,
  currentNode?: GameNode | null
): CaptureMove[] | undefined {
  const matches = chains.filter(c => c[c.length - 1].to === terminalRingId);
  if (matches.length <= 1 || !currentNode) return matches[0];

  const existing = new Set<string>();
  for (const n of currentNode.children) {
    if (n.move?.type === 'capture') {
      const d = n.move.data;
      existing.add(captureKey(d.from, [d.to, ...(d.chain || []).map(c => c.to)]));
    }
  }
  return matches.find(c => !existing.has(captureKey(c[0].from, c.map(x => x.to)))) ?? matches[0];
}

// Returns the selection slice to apply, or null when the input is invalid and
// no state change should occur. When `ringId` is null the slice clears the
// selection.
export function computeAnalysisRingSelection(
  analysisState: GameState,
  ringId: string | null
): AnalysisSelectionSlice | null {
  if (!ringId) {
    return { selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] };
  }
  const ring = analysisState.rings.get(ringId);
  if (!ring || ring.isRemoved) return null;

  if (analysisState.phase === 'capture' && ring.marble) {
    const chains = getCaptureChains(analysisState, ringId);
    if (chains.length > 0) {
      return {
        selectedRingId: ringId,
        highlightedCaptures: chains.map(c => c[c.length - 1]),
        availableCaptureChains: chains,
      };
    }
    // Marble with no captures — clear stale highlights.
    return { selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] };
  }
  if (analysisState.phase === 'capture' && !ring.marble) {
    // Empty ring clicked during capture phase — clear selection.
    return { selectedRingId: null, highlightedCaptures: [], availableCaptureChains: [] };
  }
  if (analysisState.phase === 'placement' && !ring.marble) {
    return { selectedRingId: ringId, highlightedCaptures: [] };
  }
  return null;
}

// Returns null when the placement is invalid.
export function applyAnalysisPlacement(
  analysisState: GameState,
  analysisCurrentNode: GameNode,
  ringId: string,
  color: MarbleColor
): AnalysisMoveResult | null {
  const result = applyPlacement(analysisState, ringId, color);
  if (!result) return null;

  const { newState, move } = result;
  normalizePhase(newState);

  const newNode = addMoveToTree(
    analysisCurrentNode,
    move,
    analysisState.currentPlayer,
    analysisState.moveNumber,
    analysisState.boardSize
  );
  return { analysisState: newState, analysisCurrentNode: newNode };
}

// Returns null when the ring is not removable.
export function applyAnalysisRingRemoval(
  analysisState: GameState,
  analysisCurrentNode: GameNode,
  ringId: string
): AnalysisMoveResult | null {
  const validRings = getValidRemovableRings(analysisState.rings);
  if (!validRings.includes(ringId)) return null;

  const result = applyRingRemoval(analysisState, analysisCurrentNode, ringId);
  if (!result) return null;

  const { newState } = result;
  normalizePhase(newState);
  return { analysisState: newState };
}

export function applyAnalysisCapture(
  analysisState: GameState,
  analysisCurrentNode: GameNode,
  captures: CaptureMove[]
): AnalysisMoveResult {
  const { newState, move, previousPlayer, previousMoveNumber } = applyCapture(analysisState, captures);
  normalizePhase(newState);

  const newNode = addMoveToTree(
    analysisCurrentNode,
    move,
    previousPlayer,
    previousMoveNumber,
    analysisState.boardSize
  );
  return { analysisState: newState, analysisCurrentNode: newNode };
}

export function rebuildAnalysisStateAt(targetNode: GameNode, boardSize: 37 | 48 | 61): GameState {
  return rebuildStateFromNode(targetNode, boardSize);
}

// Walks the live tree's main line and the analysis tree's main line in
// parallel, appending any new live moves into the analysis tree without
// disturbing the user's branches.
//
// The analysis tree was originally a deep clone of the live tree at
// enterAnalysis time, so they share a prefix. As the live game progresses,
// new moves appear at the end of the live main line — those need to surface
// in the analysis tree too.
//
// Behavior:
//  - If a user branch happens to exactly match the live move (move equality
//    by JSON.stringify), the branch is *promoted* to children[0] rather than
//    duplicated. Predicting an opponent's move is a feature.
//  - Otherwise a new node is unshifted to children[0] so the main-line
//    invariant (children[0] === main line) is preserved.
//  - The user's analysisCurrentNode pointer is never moved by this function;
//    callers should leave it alone so focus stays put.
//
// Returns the number of new live moves appended. Mutates analysisRoot in
// place; callers should swap the reference after merging to trigger
// subscribers (Zustand uses reference equality).
export function mergeLiveTreeIntoAnalysis(analysisRoot: GameNode, liveRoot: GameNode): number {
  let aNode = analysisRoot;
  let lNode = liveRoot;
  let added = 0;

  while (lNode.children.length > 0) {
    const liveChild = lNode.children[0];
    const moveKey = JSON.stringify(liveChild.move);
    const matchIdx = aNode.children.findIndex(c =>
      c.move && JSON.stringify(c.move) === moveKey
    );

    if (matchIdx >= 0) {
      // User's branch matches the live move — promote to main line if needed.
      if (matchIdx > 0) {
        const [matched] = aNode.children.splice(matchIdx, 1);
        aNode.children.unshift(matched);
        // Sync isMainLine flags: promoted node becomes main line, others don't.
        aNode.children[0].isMainLine = true;
        for (let ci = 1; ci < aNode.children.length; ci++) {
          aNode.children[ci].isMainLine = false;
        }
      }
      aNode = aNode.children[0];
    } else {
      // New live move — shallow-clone (the loop will recurse if there are
      // more descendants below) and unshift to become the main line.
      const cloned: GameNode = {
        id: liveChild.id,
        moveNumber: liveChild.moveNumber,
        player: liveChild.player,
        move: liveChild.move,
        notation: liveChild.notation,
        children: [],
        parent: aNode,
        isMainLine: true,
      };
      aNode.children.unshift(cloned);
      aNode = cloned;
      added++;
    }
    lNode = liveChild;
  }
  return added;
}
