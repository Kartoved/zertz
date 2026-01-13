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
  chain?: CaptureMove[];
}

export interface PlacementMove {
  marbleColor: MarbleColor;
  ringId: string;
  removedRingId: string | null;
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
  reserve: { white: number; gray: number; black: number };
  currentPlayer: Player;
  captures: {
    player1: Captures;
    player2: Captures;
  };
  phase: 'placement' | 'ringRemoval' | 'capture' | 'gameOver';
  pendingPlacement: { ringId: string; marbleColor: MarbleColor } | null;
  winner: Player | null;
  moveNumber: number;
}

export interface BoardConfig {
  size: 37 | 40 | 43 | 44 | 48;
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
