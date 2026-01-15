import {
  GameState,
  MarbleColor,
  Player,
  CaptureMove,
  Move,
  INITIAL_RESERVE,
  WIN_CONDITIONS,
} from './types';
import {
  createBoard,
  getNeighborIds,
  getRingBehind,
  getValidRemovableRings,
  getIsolatedGroups,
  idToAlgebraic,
} from './Board';

export function createInitialState(boardSize: 37 | 48 | 61 = 37): GameState {
  return {
    rings: createBoard(boardSize),
    boardSize,
    reserve: { ...INITIAL_RESERVE },
    currentPlayer: 'player1',
    captures: {
      player1: { white: 0, gray: 0, black: 0 },
      player2: { white: 0, gray: 0, black: 0 },
    },
    phase: 'placement',
    pendingPlacement: null,
    winner: null,
    moveNumber: 1,
  };
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    boardSize: state.boardSize,
    rings: new Map(Array.from(state.rings.entries()).map(([k, v]) => [k, { ...v }])),
    reserve: { ...state.reserve },
    captures: {
      player1: { ...state.captures.player1 },
      player2: { ...state.captures.player2 },
    },
    pendingPlacement: state.pendingPlacement ? { ...state.pendingPlacement } : null,
  };
}

export function getAvailableCaptures(state: GameState): CaptureMove[] {
  const captures: CaptureMove[] = [];
  
  for (const [ringId, ring] of state.rings) {
    if (ring.isRemoved || !ring.marble) continue;
    
    const neighbors = getNeighborIds(ringId, state.rings);
    
    for (const neighborId of neighbors) {
      const neighbor = state.rings.get(neighborId);
      if (!neighbor || neighbor.isRemoved || !neighbor.marble) continue;
      
      const behindId = getRingBehind(ringId, neighborId, state.rings);
      if (!behindId) continue;
      
      const behind = state.rings.get(behindId);
      if (behind && !behind.isRemoved && !behind.marble) {
        captures.push({
          from: ringId,
          to: behindId,
          captured: neighborId,
        });
      }
    }
  }
  
  return captures;
}

export function getCaptureChains(
  state: GameState,
  fromRingId: string
): CaptureMove[][] {
  const chains: CaptureMove[][] = [];
  
  function findChains(
    currentState: GameState,
    currentRingId: string,
    currentChain: CaptureMove[]
  ) {
    const ring = currentState.rings.get(currentRingId);
    if (!ring || !ring.marble) return;
    
    const neighbors = getNeighborIds(currentRingId, currentState.rings);
    let foundCapture = false;
    
    for (const neighborId of neighbors) {
      const neighbor = currentState.rings.get(neighborId);
      if (!neighbor || neighbor.isRemoved || !neighbor.marble) continue;
      
      const behindId = getRingBehind(currentRingId, neighborId, currentState.rings);
      if (!behindId) continue;
      
      const behind = currentState.rings.get(behindId);
      if (behind && !behind.isRemoved && !behind.marble) {
        foundCapture = true;
        
        const capture: CaptureMove = {
          from: currentRingId,
          to: behindId,
          captured: neighborId,
        };
        
        const newState = cloneState(currentState);
        executeCaptureSingle(newState, capture);
        
        findChains(newState, behindId, [...currentChain, capture]);
      }
    }
    
    if (!foundCapture && currentChain.length > 0) {
      chains.push(currentChain);
    }
  }
  
  const initialCaptures = getAvailableCaptures(state).filter(c => c.from === fromRingId);
  
  for (const capture of initialCaptures) {
    const newState = cloneState(state);
    executeCaptureSingle(newState, capture);
    findChains(newState, capture.to, [capture]);
  }
  
  return chains;
}

function executeCaptureSingle(state: GameState, capture: CaptureMove): void {
  const fromRing = state.rings.get(capture.from);
  const toRing = state.rings.get(capture.to);
  const capturedRing = state.rings.get(capture.captured);
  
  if (!fromRing || !toRing || !capturedRing) return;
  if (!fromRing.marble || !capturedRing.marble) return;
  
  toRing.marble = fromRing.marble;
  fromRing.marble = null;
  
  const capturedColor = capturedRing.marble.color;
  state.captures[state.currentPlayer][capturedColor]++;
  capturedRing.marble = null;
}

export function executeCapture(state: GameState, captures: CaptureMove[]): void {
  for (const capture of captures) {
    executeCaptureSingle(state, capture);
  }
  
  state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  state.moveNumber++;
}

export function getEmptyRings(state: GameState): string[] {
  const empty: string[] = [];
  for (const [id, ring] of state.rings) {
    if (!ring.isRemoved && !ring.marble) {
      empty.push(id);
    }
  }
  return empty;
}

export function canPlaceMarble(state: GameState, color: MarbleColor): boolean {
  const reserveTotal = state.reserve.white + state.reserve.gray + state.reserve.black;
  if (reserveTotal > 0) {
    return state.reserve[color] > 0;
  }
  return state.captures[state.currentPlayer][color] > 0;
}

export function placeMarble(
  state: GameState,
  ringId: string,
  color: MarbleColor
): boolean {
  const ring = state.rings.get(ringId);
  if (!ring || ring.isRemoved || ring.marble) return false;
  const reserveTotal = state.reserve.white + state.reserve.gray + state.reserve.black;
  if (reserveTotal > 0) {
    if (state.reserve[color] <= 0) return false;
    state.reserve[color]--;
  } else {
    if (state.captures[state.currentPlayer][color] <= 0) return false;
    state.captures[state.currentPlayer][color]--;
  }
  
  ring.marble = { color };
  state.pendingPlacement = { ringId, marbleColor: color };
  state.phase = 'ringRemoval';
  
  return true;
}

export function removeRing(state: GameState, ringId: string): boolean {
  const validRings = getValidRemovableRings(state.rings);
  if (!validRings.includes(ringId)) return false;
  
  const ring = state.rings.get(ringId);
  if (!ring) return false;
  
  ring.isRemoved = true;
  
  handleIsolation(state);
  
  state.pendingPlacement = null;
  state.phase = 'placement';
  state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  state.moveNumber++;
  
  return true;
}

export function skipRingRemoval(state: GameState): void {
  const validRings = getValidRemovableRings(state.rings);
  if (validRings.length === 0) {
    state.pendingPlacement = null;
    state.phase = 'placement';
    state.currentPlayer = state.currentPlayer === 'player1' ? 'player2' : 'player1';
    state.moveNumber++;
  }
}

function handleIsolation(state: GameState): void {
  const groups = getIsolatedGroups(state.rings);
  
  if (groups.length <= 1) return;
  
  let mainGroupIndex = 0;
  let maxSize = 0;
  
  for (let i = 0; i < groups.length; i++) {
    if (groups[i].length > maxSize) {
      maxSize = groups[i].length;
      mainGroupIndex = i;
    }
  }
  
  for (let i = 0; i < groups.length; i++) {
    if (i === mainGroupIndex) continue;
    
    const group = groups[i];
    const hasEmpty = group.some(id => {
      const ring = state.rings.get(id);
      return ring && !ring.marble;
    });
    
    if (!hasEmpty) {
      for (const ringId of group) {
        const ring = state.rings.get(ringId);
        if (ring && ring.marble) {
          state.captures[state.currentPlayer][ring.marble.color]++;
          ring.marble = null;
        }
        if (ring) {
          ring.isRemoved = true;
        }
      }
    }
  }
}

export function checkWinCondition(state: GameState): Player | null {
  for (const player of ['player1', 'player2'] as Player[]) {
    const caps = state.captures[player];
    
    if (caps.white >= WIN_CONDITIONS.white) return player;
    if (caps.gray >= WIN_CONDITIONS.gray) return player;
    if (caps.black >= WIN_CONDITIONS.black) return player;
    
    if (
      caps.white >= WIN_CONDITIONS.allColors &&
      caps.gray >= WIN_CONDITIONS.allColors &&
      caps.black >= WIN_CONDITIONS.allColors
    ) {
      return player;
    }
  }
  
  return null;
}

export function hasAvailableCaptures(state: GameState): boolean {
  return getAvailableCaptures(state).length > 0;
}

export function getAvailableMoves(state: GameState): {
  type: 'capture' | 'placement';
  captures?: CaptureMove[];
  placements?: { ringId: string; colors: MarbleColor[] }[];
} {
  if (hasAvailableCaptures(state)) {
    return {
      type: 'capture',
      captures: getAvailableCaptures(state),
    };
  }
  
  const emptyRings = getEmptyRings(state);
  const availableColors: MarbleColor[] = [];

  const reserveTotal = state.reserve.white + state.reserve.gray + state.reserve.black;
  if (reserveTotal > 0) {
    if (state.reserve.white > 0) availableColors.push('white');
    if (state.reserve.gray > 0) availableColors.push('gray');
    if (state.reserve.black > 0) availableColors.push('black');
  } else {
    const caps = state.captures[state.currentPlayer];
    if (caps.white > 0) availableColors.push('white');
    if (caps.gray > 0) availableColors.push('gray');
    if (caps.black > 0) availableColors.push('black');
  }
  
  return {
    type: 'placement',
    placements: emptyRings.map(ringId => ({
      ringId,
      colors: availableColors,
    })),
  };
}

// Format: "Wa2 -b4" for placement, "Ba1-c3-c5" for capture chain
export function moveToNotation(move: Move, boardSize: 37 | 48 | 61 = 37): string {
  if (move.type === 'capture') {
    const chain = [move.data, ...(move.data.chain || [])];
    const fromRing = chain[0].from;
    const fromAlg = idToAlgebraic(fromRing, boardSize);
    const marble = 'B'; // Captures don't specify color, use first letter based on actual marble
    const positions = chain.map(c => idToAlgebraic(c.to, boardSize));
    return `${marble}${fromAlg}-${positions.join('-')}`;
  } else {
    const { marbleColor, ringId, removedRingId } = move.data;
    const colorChar = marbleColor[0].toUpperCase();
    const ringAlg = idToAlgebraic(ringId, boardSize);
    if (removedRingId) {
      const removedAlg = idToAlgebraic(removedRingId, boardSize);
      return `${colorChar}${ringAlg} -${removedAlg}`;
    }
    return `${colorChar}${ringAlg}`;
  }
}

// Get win type for display
export function getWinType(state: GameState, winner: Player): string {
  const caps = state.captures[winner];
  
  if (caps.white >= WIN_CONDITIONS.white) return 'white';
  if (caps.gray >= WIN_CONDITIONS.gray) return 'gray';
  if (caps.black >= WIN_CONDITIONS.black) return 'black';
  if (
    caps.white >= WIN_CONDITIONS.allColors &&
    caps.gray >= WIN_CONDITIONS.allColors &&
    caps.black >= WIN_CONDITIONS.allColors
  ) {
    return 'mixed';
  }
  return 'unknown';
}
