export type MarbleColor = 'white' | 'gray' | 'black';
export type Player = 'player1' | 'player2';

export interface Marble {
  color: MarbleColor;
}

export interface Ring {
  id: string;
  q: number;
  r: number;
  marble: Marble | null;
  isRemoved: boolean;
}

export interface CaptureMove {
  from: string;
  to: string;
  captured: string;
  marbleColor?: MarbleColor;
  capturedColor?: MarbleColor;
  chain?: CaptureMove[];
}

export interface PlacementMove {
  marbleColor: MarbleColor;
  ringId: string;
  removedRingId: string | null;
  isolatedCaptures?: MarbleColor[];
}

export type Move = 
  | { type: 'placement'; data: PlacementMove }
  | { type: 'capture'; data: CaptureMove };

export interface GameNode {
  id: string;
  moveNumber: number;
  player: Player;
  move: Move | null;
  notation: string;
  children: GameNode[];
  parent: GameNode | null;
  isMainLine: boolean;
}

export interface Captures {
  white: number;
  gray: number;
  black: number;
}

export interface GameState {
  rings: Map<string, Ring>;
  boardSize: 37 | 48 | 61;
  reserve: { white: number; gray: number; black: number };
  currentPlayer: Player;
  captures: {
    player1: Captures;
    player2: Captures;
  };
  phase: 'placement' | 'ringRemoval' | 'capture' | 'gameOver';
  pendingPlacement: { ringId: string; marbleColor: MarbleColor } | null;
  winner: Player | 'cancelled' | null;
  moveNumber: number;
}

export interface BoardConfig {
  size: 37 | 48 | 61;
}

export const INITIAL_RESERVE = {
  white: 6,
  gray: 8,
  black: 10,
};

export const WIN_CONDITIONS = {
  white: 4,
  gray: 5,
  black: 6,
  allColors: 3,
};

// Conditional pre-moves for correspondence games.
// A variant is a sequence of moves alternating expected-opponent / my-response.
// `sequence[0]` is what I expect the opponent to play next from the live position.
// `sequence[1]` is the move I want auto-played in response. And so on for chains.
export interface PreMoveStep {
  move: Move;
  notation: string;
  player: Player;          // who makes this move (player1 or player2)
  newStateJson: string;    // serialized GameState AFTER this move
  newCurrentPlayer: 1 | 2; // whose turn AFTER this move
  newWinner: number | null;
  newWinType: string | null;
}

export interface PreMoveVariant {
  id: string;
  sequence: PreMoveStep[];
}

export interface PreMovesByPlayer {
  player1: PreMoveVariant[];
  player2: PreMoveVariant[];
}
