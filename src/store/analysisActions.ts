import { GameState, GameNode, MarbleColor, CaptureMove, PreMoveVariant } from '../game/types';
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

// Mutates `startNode` in place: injects saved pre-move variants as branches so
// the user can navigate them in the move-history widget. Variants sharing a
// prefix collapse into the same nodes.
export function injectPremovesIntoTree(startNode: GameNode, premoves: PreMoveVariant[]): void {
  for (const variant of premoves) {
    let parent = startNode;
    for (let i = 0; i < variant.sequence.length; i++) {
      const step = variant.sequence[i];
      const existing = parent.children.find(c =>
        c.move && JSON.stringify(c.move) === JSON.stringify(step.move)
      );
      if (existing) {
        parent = existing;
        continue;
      }
      const newNode: GameNode = {
        id: `pm-${variant.id}-${i}`,
        moveNumber: parent.moveNumber + 1,
        player: step.player,
        move: step.move,
        notation: step.notation,
        children: [],
        parent,
        isMainLine: parent.children.length === 0,
      };
      parent.children.push(newNode);
      parent = newNode;
    }
  }
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
    if (chains.length === 0) return null;
    return {
      selectedRingId: ringId,
      highlightedCaptures: chains.flat(),
      availableCaptureChains: chains,
    };
  }
  if (analysisState.phase === 'placement' && !ring.marble) {
    // Preserve original behavior: do not clear availableCaptureChains here.
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
